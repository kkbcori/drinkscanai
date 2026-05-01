#!/usr/bin/env python3
"""
fetch_drink_images.py
DrinkScanAI — Download labeled drink images from Open Images V7

Adapted directly from StowBuddy's fetch_datasets.py.
Uses FiftyOne to pull real drink photos with bounding boxes.

Usage:
    pip install fiftyone torch torchvision Pillow numpy pyyaml rich
    python fetch_drink_images.py                      # full download ~10k images
    python fetch_drink_images.py --max-per-class 20  # smoke test (fast)
    python fetch_drink_images.py --dry-run            # show plan only

Output:
    FiftyOne dataset "drinkscanai-seed" with downloaded images.
    Then run: python build_drink_embeddings.py
"""
from __future__ import annotations
import argparse, sys
from pathlib import Path
import yaml
from rich.console import Console
from rich.table import Table

console = Console()
DATASET_NAME = "drinkscanai-seed"
SCRIPT_DIR   = Path(__file__).parent.resolve()

def load_labels(path: Path) -> dict:
    with path.open() as f:
        cfg = yaml.safe_load(f)
    return cfg

def summarize_plan(cfg: dict, max_override: int | None) -> None:
    table = Table(title="DrinkScanAI — Download Plan", header_style="bold cyan")
    table.add_column("ID", style="dim")
    table.add_column("Display")
    table.add_column("Target", justify="right")
    table.add_column("OI Classes", style="dim")
    total = 0
    for e in cfg["labels"]:
        t = max_override or e.get("target_count", 200)
        total += t
        table.add_row(e["id"], e["display"], str(t),
                      ", ".join(e.get("oi_classes", [])))
    console.print(table)
    console.print(f"\n[bold]Total target: ~{total:,} images across {len(cfg['labels'])} drink categories[/bold]\n")

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", type=Path, default=SCRIPT_DIR / "drink_labels.yaml")
    ap.add_argument("--max-per-class", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--reset", action="store_true")
    ap.add_argument("--skip-existing", action="store_true")
    args = ap.parse_args()

    cfg = load_labels(args.labels)
    console.print(f"[bold]Loaded {len(cfg['labels'])} drink categories[/bold]")
    summarize_plan(cfg, args.max_per_class)

    if args.dry_run:
        console.print("[yellow]Dry run — exiting.[/yellow]")
        return 0

    import fiftyone as fo
    import fiftyone.zoo as foz

    if args.reset and DATASET_NAME in fo.list_datasets():
        console.print(f"[yellow]Resetting {DATASET_NAME}[/yellow]")
        fo.delete_dataset(DATASET_NAME)

    if args.skip_existing and DATASET_NAME in fo.list_datasets():
        ds = fo.load_dataset(DATASET_NAME)
        console.print(f"[green]Dataset exists: {len(ds):,} images.[/green]")
        return 0

    # Collect all OI class names needed
    all_oi_classes: set[str] = set()
    for entry in cfg["labels"]:
        for cls in entry.get("oi_classes", []):
            all_oi_classes.add(cls)

    total_max = sum(
        (args.max_per_class or e.get("target_count", 200))
        for e in cfg["labels"]
    )

    console.print(f"[cyan]Downloading from Open Images V7...[/cyan]")
    console.print(f"  Classes: {sorted(all_oi_classes)}")
    console.print(f"  Target:  ~{total_max:,} images")
    console.print(f"  Note:    First run downloads ~25GB. Subsequent runs use cache.\n")

    dataset = foz.load_zoo_dataset(
        "open-images-v7",
        split="train",
        label_types=["detections"],
        classes=sorted(all_oi_classes),
        max_samples=int(total_max * 1.3),  # 30% buffer for filtering
        only_matching=True,
        shuffle=True,
        seed=42,
        dataset_name=DATASET_NAME,
    )

    dataset.persistent = True
    dataset.save()

    console.print(f"\n[bold green]✓ Downloaded {len(dataset):,} images[/bold green]")
    console.print("Next: [cyan]python build_drink_embeddings.py[/cyan]")
    return 0

if __name__ == "__main__":
    sys.exit(main())
