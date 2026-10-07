# JUYO moderation bench (developer only)

Benchmark and training for the weapons moderation head (decision and numbers:
[RESULTS.md](RESULTS.md)). Everything runs on the developer's computer with
ONNX Runtime Web (WASM), using `onnxruntime-web` and `sharp` already installed
in `Web/` — no new library. No image is sent to any AI service; the only
network use is downloading the dataset and the pinned model files below.

Not part of the website: `tools/` is excluded from `tsconfig.json`; `out/`
(vectors, results) is git-ignored and must never be committed.

## Inputs

- `<data-dir>/meta/` — official Open Images V7 files:
  `class-descriptions.csv` (`oidv7-class-descriptions.csv`),
  `validation-labels.csv` (`oidv7-val-annotations-human-imagelabels.csv`),
  `test-labels.csv` (`oidv7-test-annotations-human-imagelabels.csv`),
  `validation-images.csv`, `test-images.csv` (`2018_04/*-images-with-rotation.csv`),
  all from `https://storage.googleapis.com/openimages/`.
- `<models-dir>/` — `siglip_text_q.onnx` (Xenova/siglip-base-patch16-224
  `onnx/text_model_quantized.onnx`, sha256 `ad0329b1…4dce2`, Apache-2.0) and
  `siglip_tokenizer.json` — only for the zero-shot comparison.
- DINOv2 (`public/models/visual/`) and SigLIP vision
  (`services/vision/models/`) are read from the repo, checksum-verified.
