#!/usr/bin/env python3
"""
build_drink_embeddings.py
DrinkScanAI — Extract MobileNetV2 embeddings + train drink classifier

Adapted from StowBuddy's build_seed_bank.py.
Runs entirely on Windows (no coremltools needed).

Pipeline:
  1. Load FiftyOne dataset from fetch_drink_images.py
  2. Crop images to bounding boxes (same as StowBuddy)
  3. Extract MobileNetV2 1280-d embeddings
  4. Deduplicate (same threshold as StowBuddy: 0.97)
  5. Train linear classifier head on embeddings
  6. Save drink_classifier.pt (weights only, small file)
  7. Save drink_embeddings.npz (for future retraining)

CoreML export is done separately in GitHub Actions (macOS only).

Usage:
    python build_drink_embeddings.py                # full run
    python build_drink_embeddings.py --limit 500    # smoke test
    python build_drink_embeddings.py --epochs 30    # more training
"""
from __future__ import annotations
import argparse, json, sys
from collections import Counter, defaultdict
from pathlib import Path
import numpy as np
from PIL import Image
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn
import yaml

console = Console()
DATASET_NAME  = "drinkscanai-seed"
EMBEDDING_DIM = 1280
INPUT_SIZE    = 224
SCRIPT_DIR    = Path(__file__).parent.resolve()

# ── Label config ──────────────────────────────────────────────────────────

def load_config(path: Path) -> dict:
    with path.open() as f:
        return yaml.safe_load(f)

def build_class_map(cfg: dict) -> dict[str, str]:
    """OI class name (lowercase) → our drink ID"""
    m: dict[str, str] = {}
    for entry in cfg["labels"]:
        for cls in entry.get("oi_classes", []):
            m[cls.lower().strip()] = entry["id"]
    return m

# ── Image preprocessing (identical to StowBuddy) ─────────────────────────

def crop_to_box(img: Image.Image, bbox) -> Image.Image | None:
    W, H = img.size
    x, y, w, h = bbox
    if w * h < 0.01 or w < 0.05 or h < 0.05:
        return None
    mx, my = 0.1 * w, 0.1 * h
    x0 = max(0, (x - mx) * W)
    y0 = max(0, (y - my) * H)
    x1 = min(W, (x + w + mx) * W)
    y1 = min(H, (y + h + my) * H)
    c = img.crop((x0, y0, x1, y1))
    return c if c.size[0] >= 32 and c.size[1] >= 32 else None

def preprocess(img: Image.Image) -> np.ndarray:
    """Resize + ImageNet normalization — identical to StowBuddy"""
    img = img.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.LANCZOS)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    arr = (arr - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    return arr  # HWC float32

# ── MobileNetV2 Embedder (identical to StowBuddy) ─────────────────────────

class Embedder:
    """MobileNetV2 1280-d feature extractor — same model as StowBuddy"""
    def __init__(self, batch_size: int = 32):
        import torch
        import torch.nn as nn
        from torchvision.models import mobilenet_v2, MobileNet_V2_Weights

        console.print("[cyan]Loading MobileNetV2 (same weights as StowBuddy)...[/cyan]")
        full = mobilenet_v2(weights=MobileNet_V2_Weights.IMAGENET1K_V2)
        self.model = nn.Sequential(
            full.features,
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
        ).eval()

        if torch.cuda.is_available():
            self.device = torch.device("cuda")
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            self.device = torch.device("mps")
        else:
            self.device = torch.device("cpu")

        self.model = self.model.to(self.device)
        self.batch_size = batch_size
        self._torch = torch

        with torch.inference_mode():
            dummy = torch.zeros((1, 3, INPUT_SIZE, INPUT_SIZE), device=self.device)
            _ = self.model(dummy)
        console.print(f"[green]✓ Embedder ready[/green] [dim](device={self.device})[/dim]")

    def embed_batch(self, images: list[np.ndarray]) -> np.ndarray:
        if not images:
            return np.zeros((0, EMBEDDING_DIM), dtype=np.float32)
        t = self._torch
        batch = np.stack(images).transpose(0, 3, 1, 2).astype(np.float32)
        with t.inference_mode():
            out = self.model(t.from_numpy(batch).to(self.device)).cpu().numpy()
        return out.astype(np.float32)

# ── Deduplication (identical to StowBuddy) ───────────────────────────────

def deduplicate(embeddings: np.ndarray, labels: list[str], threshold=0.97):
    by_label = defaultdict(list)
    for i, lbl in enumerate(labels):
        by_label[lbl].append(i)
    keep = np.ones(len(labels), dtype=bool)
    for lbl, idxs in by_label.items():
        group = embeddings[idxs]
        norms = np.linalg.norm(group, axis=1, keepdims=True) + 1e-12
        normed = group / norms
        for i in range(len(idxs)):
            if not keep[idxs[i]]: continue
            sims = normed[i] @ normed.T
            for j in range(i + 1, len(idxs)):
                if keep[idxs[j]] and sims[j] > threshold:
                    keep[idxs[j]] = False
    removed = (~keep).sum()
    if removed:
        console.print(f"[yellow]Dedup: removed {removed:,} near-duplicates (threshold={threshold})[/yellow]")
    return keep

# ── Extract embeddings from FiftyOne dataset ──────────────────────────────

def extract_embeddings(cfg: dict, args) -> tuple[np.ndarray, list[str]]:
    import fiftyone as fo
    class_map = build_class_map(cfg)

    if DATASET_NAME not in fo.list_datasets():
        console.print(f"[red]Dataset '{DATASET_NAME}' not found.[/red]")
        console.print("Run: python fetch_drink_images.py")
        sys.exit(1)

    dataset = fo.load_dataset(DATASET_NAME)
    console.print(f"[green]✓ Loaded {len(dataset):,} images[/green]")

    embedder = Embedder()
    all_embeddings, all_labels = [], []
    pending_imgs, pending_labels = [], []
    limit = args.limit or len(dataset)

    with Progress(SpinnerColumn(), TextColumn("{task.description}"),
                  BarColumn(), TextColumn("{task.completed}/{task.total}"),
                  TimeRemainingColumn(), console=console) as progress:
        task = progress.add_task("Extracting embeddings...", total=min(limit, len(dataset)))

        for i, sample in enumerate(dataset.iter_samples()):
            if i >= limit: break
            try:
                img = Image.open(sample.filepath)
            except Exception:
                progress.advance(task)
                continue

            dets = getattr(sample, "ground_truth", None) or getattr(sample, "detections", None)
            if dets is None:
                for fld in sample.field_names:
                    val = sample[fld]
                    if hasattr(val, "detections"):
                        dets = val; break

            if not getattr(dets, "detections", None):
                progress.advance(task)
                continue

            for det in dets.detections:
                cls_key = det.label.lower().strip()
                if cls_key not in class_map: continue
                cropped = crop_to_box(img, det.bounding_box)
                if cropped is None: continue
                pending_imgs.append(preprocess(cropped))
                pending_labels.append(class_map[cls_key])

                if len(pending_imgs) >= embedder.batch_size:
                    embs = embedder.embed_batch(pending_imgs)
                    all_embeddings.extend(embs)
                    all_labels.extend(pending_labels)
                    pending_imgs.clear(); pending_labels.clear()

            progress.advance(task)

        if pending_imgs:
            all_embeddings.extend(embedder.embed_batch(pending_imgs))
            all_labels.extend(pending_labels)

    embeddings = np.array(all_embeddings, dtype=np.float32)
    console.print(f"\n[bold]Extracted {len(embeddings):,} embeddings[/bold]")
    for drink_id, count in sorted(Counter(all_labels).items()):
        bar = "█" * min(40, count // 5)
        console.print(f"  {drink_id:25s} {count:4d}  {bar}")
    return embeddings, all_labels

# ── Train classifier head ─────────────────────────────────────────────────

def train_classifier(embeddings: np.ndarray, labels: list[str], cfg: dict, args):
    import torch
    import torch.nn as nn
    from torch.utils.data import TensorDataset, DataLoader

    drink_ids   = [e["id"] for e in cfg["labels"]]
    drink_names = [e["display"] for e in cfg["labels"]]
    label_to_idx = {lid: i for i, lid in enumerate(drink_ids)}
    NUM_CLASSES  = len(drink_ids)

    # Filter to classes we have embeddings for
    valid = [(emb, lbl) for emb, lbl in zip(embeddings, labels) if lbl in label_to_idx]
    if not valid:
        console.print("[red]No valid embeddings for known classes.[/red]")
        sys.exit(1)

    X = np.stack([v[0] for v in valid]).astype(np.float32)
    y = np.array([label_to_idx[v[1]] for v in valid], dtype=np.int64)

    # Normalize (same as StowBuddy inference)
    X /= np.linalg.norm(X, axis=1, keepdims=True) + 1e-12

    console.print(f"\n[cyan]Training on {len(X):,} embeddings → {NUM_CLASSES} drink classes[/cyan]")
    console.print(f"  Classes with data: {len(set(labels))} / {NUM_CLASSES}")

    classes_with_data = set(labels)
    for e in cfg["labels"]:
        if e["id"] not in classes_with_data:
            console.print(f"  [yellow]⚠ No images for: {e['display']}[/yellow]")

    device = (torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu"))
    X_t = torch.from_numpy(X).to(device)
    y_t = torch.from_numpy(y).to(device)

    classifier = nn.Sequential(
        nn.Linear(EMBEDDING_DIM, 512),
        nn.BatchNorm1d(512),
        nn.ReLU(),
        nn.Dropout(0.3),
        nn.Linear(512, NUM_CLASSES),
    ).to(device)

    # Xavier init
    for layer in classifier:
        if isinstance(layer, nn.Linear):
            nn.init.xavier_uniform_(layer.weight)
            nn.init.zeros_(layer.bias)

    optimizer = torch.optim.AdamW(classifier.parameters(), lr=1e-3, weight_decay=0.01)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    loss_fn   = nn.CrossEntropyLoss()
    loader    = DataLoader(TensorDataset(X_t, y_t), batch_size=256, shuffle=True)

    best_acc = 0
    for epoch in range(args.epochs):
        classifier.train()
        total_loss = correct = total = 0
        for xb, yb in loader:
            optimizer.zero_grad()
            logits = classifier(xb)
            loss = loss_fn(logits, yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(xb)
            correct += (logits.argmax(1) == yb).sum().item()
            total += len(xb)
        scheduler.step()
        acc = correct / total * 100
        if acc > best_acc: best_acc = acc
        if (epoch + 1) % 5 == 0 or epoch == 0:
            console.print(f"  Epoch {epoch+1:3d}/{args.epochs}  loss={total_loss/total:.4f}  acc={acc:.1f}%")

    console.print(f"\n[bold green]Training complete. Best acc: {best_acc:.1f}%[/bold green]")
    return classifier.eval().cpu(), drink_ids, drink_names

# ── Save weights ──────────────────────────────────────────────────────────

def save_weights(classifier, drink_ids: list[str], drink_names: list[str],
                 out_dir: Path, args):
    import torch
    out_dir.mkdir(parents=True, exist_ok=True)

    # Save classifier weights (small — ~3MB)
    weights_path = out_dir / "drink_classifier.pt"
    torch.save({
        "state_dict":  classifier.state_dict(),
        "drink_ids":   drink_ids,
        "drink_names": drink_names,
        "embedding_dim": EMBEDDING_DIM,
        "num_classes": len(drink_ids),
        "input_size":  INPUT_SIZE,
    }, weights_path)
    console.print(f"[green]✓ Saved weights: {weights_path} ({weights_path.stat().st_size/1024:.0f} KB)[/green]")

    # Save embedding bank (larger — for future retraining without re-downloading)
    emb_path = out_dir / "drink_embeddings.npz"
    console.print(f"[dim]  Embeddings saved to {emb_path} (for future retraining)[/dim]")

    return weights_path

# ── Main ──────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--labels", type=Path, default=SCRIPT_DIR / "drink_labels.yaml")
    ap.add_argument("--output", type=Path, default=SCRIPT_DIR / "out")
    ap.add_argument("--limit", type=int, default=None, help="Max images (smoke test)")
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--no-dedup", action="store_true")
    args = ap.parse_args()

    cfg = load_config(args.labels)

    # Step 1: Extract embeddings
    embeddings, labels = extract_embeddings(cfg, args)
    if len(embeddings) == 0:
        console.print("[red]No embeddings. Run fetch_drink_images.py first.[/red]")
        return 1

    # Step 2: Save embedding bank
    args.output.mkdir(parents=True, exist_ok=True)
    np.savez(args.output / "drink_embeddings.npz",
             embeddings=embeddings, labels=np.array(labels))

    # Step 3: Deduplicate
    if not args.no_dedup:
        keep = deduplicate(embeddings, labels)
        embeddings = embeddings[keep]
        labels = [l for l, k in zip(labels, keep) if k]

    # Step 4: Train classifier
    classifier, drink_ids, drink_names = train_classifier(embeddings, labels, cfg, args)

    # Step 5: Save weights
    weights_path = save_weights(classifier, drink_ids, drink_names, args.output, args)

    console.print(f"""
╔══════════════════════════════════════════════════════════╗
║      DrinkScanAI Classifier Trained ✅                    ║
╚══════════════════════════════════════════════════════════╝

NEXT STEPS:

1. Commit the weights file to git:
   git add tools/out/drink_classifier.pt
   git commit -m "feat: trained drink classifier weights"
   git push

2. The 'Convert to CoreML' GitHub Actions workflow will
   automatically load these weights and export DrinkClassifier.mlpackage
   (CoreML export requires macOS — handled by the CI runner)

3. Trigger the workflow:
   GitHub → Actions → Convert to CoreML → Run workflow
""")
    return 0

if __name__ == "__main__":
    sys.exit(main())
