# DrinkScanAI — Drink Classifier Training Pipeline

Adapted from StowBuddy tools. Downloads real drink photos from Open Images V7,
extracts MobileNetV2 embeddings, trains a classifier on Windows,
then exports to CoreML via GitHub Actions (macOS).

---

## Why split Windows / macOS?

- `fiftyone` (dataset download) works on Windows ✅
- `torch` + `torchvision` (training) works on Windows ✅
- `coremltools` (CoreML export) requires macOS ❌
- GitHub Actions `macos-26` runner handles the CoreML export automatically

---

## One-time setup (Windows PC)

```powershell
cd C:\Users\kisb\Andriod_App_Projects\DrinkScanAI\tools

# Python 3.12 required — FiftyOne caps at 3.12
py -3.12 -m venv .venv
.venv\Scripts\activate

pip install -r requirements_drink.txt
```

Verify Python version:
```powershell
python --version   # Must show 3.12.x NOT 3.13 or 3.14
```

---

## Step 1 — Smoke test (5 min, ~500MB)

```powershell
# Download only 10 images per class to test the pipeline
python fetch_drink_images.py --max-per-class 10
python build_drink_embeddings.py --limit 200 --epochs 5
```

Check `tools/out/drink_classifier.pt` exists and is ~3MB.
If smoke test passes, proceed to full run.

---

## Step 2 — Full image download (2-3 hours, ~25GB disk)

```powershell
python fetch_drink_images.py --reset
```

This downloads ~10,000 real drink photos from Open Images V7.
**Leave it running overnight** — it resumes automatically if interrupted.
First run caches images to `~/.fiftyone/` — subsequent runs are instant.

Progress shown as a table. Expected output:
```
  coffee            400 images  ████████████████████
  beer              500 images  █████████████████████████
  water             500 images  █████████████████████████
  ...
```

---

## Step 3 — Train classifier (30-60 min on CPU)

```powershell
python build_drink_embeddings.py --epochs 30
```

Output in `tools/out/`:
- `drink_embeddings.npz`  — save this, avoids re-downloading for future retraining
- `drink_classifier.pt`   — trained weights (~3MB), commit this to git

Expected training output:
```
  Epoch  1/30  loss=3.2847  acc=12.3%
  Epoch  5/30  loss=1.9234  acc=54.1%
  Epoch 10/30  loss=1.2341  acc=71.8%
  Epoch 20/30  loss=0.8123  acc=79.4%
  Epoch 30/30  loss=0.6891  acc=83.2%
```

---

## Step 4 — Commit weights and export CoreML

```powershell
git add tools/out/drink_classifier.pt
git commit -m "feat: trained drink classifier on Open Images v7"
git push
```

Then trigger CoreML export in GitHub Actions:
1. Go to `github.com/kkbcori/drinkscanai/actions`
2. Click **"Convert to CoreML"**
3. Click **"Run workflow"**

The workflow loads `drink_classifier.pt`, exports `DrinkClassifier.mlpackage`,
and commits it to the repo automatically (~10 min).

---

## Step 5 — Build and install

The next `ios beta` build automatically includes the new model.
Or trigger it manually:

```powershell
git commit --allow-empty -m "trigger: rebuild with fine-tuned drink classifier"
git push
```

Install from TestFlight — scan drinks. Expected accuracy: **75-85%**.

---

## Retraining (adding categories or improving accuracy)

```powershell
# Add new drink to drink_labels.yaml, then:
python fetch_drink_images.py --skip-existing   # only fetches new classes
python build_drink_embeddings.py --epochs 30   # retrain from saved embeddings
git add tools/out/drink_classifier.pt
git commit -m "feat: retrained with new drink categories"
git push
# Trigger Convert to CoreML workflow
```

To retrain from saved embeddings without re-downloading:
```powershell
# Edit build_drink_embeddings.py to load from drink_embeddings.npz
# instead of FiftyOne — saves hours
```

---

## Expected accuracy by training data size

| Images per class | Expected accuracy |
|---|---|
| 10 (smoke test)  | ~35-45%  |
| 100              | ~60-68%  |
| 300 (default)    | ~75-82%  |
| 500+             | ~82-88%  |
| + user corrections | ~88-93% |

---

## Phase 2 — OTA model updates via Supabase (planned)

Like StowBuddy, we'll add:
- Upload `drink_classifier.pt` to Supabase Storage
- App checks for new weights on launch
- Downloads and applies without App Store update
- User corrections feed back into next training cycle

This is the same pattern as StowBuddy steps 19-25 in the project flow.
