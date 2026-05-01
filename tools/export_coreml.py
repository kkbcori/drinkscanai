"""
export_coreml.py
DrinkScanAI — Load trained drink_classifier.pt and export to CoreML

Runs on GitHub Actions macos-26 runner.
Called by .github/workflows/convert_coreml.yml
"""
import json, os, sys
import torch
import torch.nn as nn
from torchvision.models import mobilenet_v2, MobileNet_V2_Weights
import coremltools as ct
from PIL import Image
import numpy as np

WEIGHTS_PATH  = "tools/out/drink_classifier.pt"
OUT_PATH      = "ios/DrinkScanAI/ML/DrinkClassifier.mlpackage"
INPUT_SIZE    = 224
EMBEDDING_DIM = 1280

# ── Load trained weights ──────────────────────────────────────────────────
if not os.path.exists(WEIGHTS_PATH):
    print(f"ERROR: {WEIGHTS_PATH} not found.")
    print("Run build_drink_embeddings.py on your PC first, then commit the weights.")
    sys.exit(1)

print(f"Loading weights from {WEIGHTS_PATH}...")
checkpoint  = torch.load(WEIGHTS_PATH, map_location="cpu")
drink_ids   = checkpoint["drink_ids"]
drink_names = checkpoint["drink_names"]
NUM_CLASSES = checkpoint["num_classes"]
print(f"Loaded weights: {NUM_CLASSES} drink classes")
print(f"Classes: {drink_ids}")

# ── Rebuild classifier head (must match build_drink_embeddings.py) ─────────
classifier = nn.Sequential(
    nn.Linear(EMBEDDING_DIM, 512),
    nn.BatchNorm1d(512),
    nn.ReLU(),
    nn.Dropout(0.3),
    nn.Linear(512, NUM_CLASSES),
)
classifier.load_state_dict(checkpoint["state_dict"])
classifier.eval()
print("Classifier head loaded")

# ── Load MobileNetV2 backbone ─────────────────────────────────────────────
print("Loading MobileNetV2 backbone...")
full_mv2 = mobilenet_v2(weights=MobileNet_V2_Weights.IMAGENET1K_V2)
backbone = nn.Sequential(
    full_mv2.features,
    nn.AdaptiveAvgPool2d((1, 1)),
    nn.Flatten(),
).eval()

# ── Combine backbone + trained head ──────────────────────────────────────
class FullDrinkModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone   = backbone
        self.classifier = classifier

    def forward(self, x):
        features = self.backbone(x)
        # L2 normalize — same as during training
        normed = features / (features.norm(dim=1, keepdim=True) + 1e-12)
        return self.classifier(normed)

model = FullDrinkModel().eval()

# Quick sanity check
with torch.no_grad():
    dummy_out = model(torch.zeros(1, 3, INPUT_SIZE, INPUT_SIZE))
    print(f"Model output shape: {dummy_out.shape} ✓")

# ── Trace for CoreML ──────────────────────────────────────────────────────
print("Tracing model...")
dummy = torch.zeros(1, 3, INPUT_SIZE, INPUT_SIZE)
with torch.no_grad():
    traced = torch.jit.trace(model, dummy)
print("Trace complete")

# ── Convert to CoreML ─────────────────────────────────────────────────────
print("Converting to CoreML (Neural Engine target)...")
mlmodel = ct.convert(
    traced,
    inputs=[ct.ImageType(
        name="image",
        shape=(1, 3, INPUT_SIZE, INPUT_SIZE),
        scale=1.0/255.0,
        bias=[-0.485/0.229, -0.456/0.224, -0.406/0.225],
        color_layout=ct.colorlayout.RGB,
    )],
    outputs=[ct.TensorType(name="logits")],
    minimum_deployment_target=ct.target.iOS16,
    compute_units=ct.ComputeUnit.ALL,
)
print("Conversion complete")

# ── Metadata ──────────────────────────────────────────────────────────────
mlmodel.short_description = f"DrinkScanAI MobileNetV2 fine-tuned on Open Images v7 — {NUM_CLASSES} drinks"
mlmodel.author  = "DrinkScanAI"
mlmodel.version = "3.0"
mlmodel.user_defined_metadata["classes"] = json.dumps([
    {"index": i, "id": drink_ids[i], "name": drink_names[i]}
    for i in range(NUM_CLASSES)
])
mlmodel.user_defined_metadata["num_classes"] = str(NUM_CLASSES)
mlmodel.user_defined_metadata["input_size"]  = str(INPUT_SIZE)
mlmodel.user_defined_metadata["training"]    = "open_images_v7_finetuned"

# ── Save ──────────────────────────────────────────────────────────────────
os.makedirs("ios/DrinkScanAI/ML", exist_ok=True)
mlmodel.save(OUT_PATH)
size_mb = sum(
    os.path.getsize(os.path.join(dp, f))
    for dp, _, fs in os.walk(OUT_PATH) for f in fs
) / 1024 / 1024
print(f"Saved: {OUT_PATH} ({size_mb:.1f} MB)")

# ── Validate ──────────────────────────────────────────────────────────────
print("Validating...")
dummy_img = Image.fromarray(
    np.random.randint(0, 255, (INPUT_SIZE, INPUT_SIZE, 3), dtype=np.uint8)
)
result = mlmodel.predict({"image": dummy_img})
logits = list(result["logits"][0])
top_i  = logits.index(max(logits))
print(f"Test prediction: {drink_names[top_i]}")
print(f"Classes in model: {NUM_CLASSES}")
print("Done! ✅")
