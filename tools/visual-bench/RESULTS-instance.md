# Real multi-view benchmark (2026-10-08)

`instance-bench.ts` on 108 objects from Google Objectron (C-UDA-1.0, computational use; 9 categories × 12: bike, book, bottle, camera, cereal box, chair, cup, laptop, shoe). Three frames per object from different camera positions. Gallery = frame 0 of every object + 99 JUYO listing photos as distractors (Documents/Cards excluded); queries = frames 1 and 2 (216 queries). Hard negatives = other objects of the same category. TPR is measured at 1 % false positives among same-category objects.

| Model | Size | Method | R@1 | R@5 | mAP | TPR@1%FPR |
|---|---|---|---|---|---|---|
| DINOv2-S/14 q4 @280 (production since 2026-10-07) | 16.9 MB | global | 88.4 | 99.1 | 92.9 | 63.0 |
| DINOv2-S/14 q4 @280 | 16.9 MB | + mirror | 91.7 | 99.1 | 94.7 | 68.1 |
| DINOv2-S/14 q4 @280 | 16.9 MB | + object crop (patch PCA) | 89.8 | 98.6 | 93.4 | 63.9 |
| DINOv2-S/14 q4 @392 | 16.9 MB | global | 90.3 | 98.1 | 93.7 | 62.5 |
| SigLIP B/16 q8 @224 | 99.5 MB | global | 95.8 | 99.1 | 97.2 | 81.5 |
| **SigLIP 2 B/16 q4 @256** | **63.5 MB** | **global** | **98.6** | **100** | **99.1** | **85.2** |
| SigLIP 2 B/16 q4 @256 | 63.5 MB | + mirror | 98.6 | 100 | 99.1 | 89.4 |
| SigLIP 2 B/16 q4 @384 | 64.4 MB | global | 97.2 | 99.5 | 98.3 | 90.3 |
| SigLIP 2 B/16 q4 @384 | 64.4 MB | + mirror | 98.6 | 100 | 99.1 | 93.1 |

Latency of one inference, onnxruntime-web WASM, 4 threads, this PC: DINOv2 @280 0.76 s, SigLIP 2 @256 1.6 s, SigLIP 2 @384 3.3 s. juyo.tj runs WASM with 1 thread (no cross-origin isolation), so roughly 4× slower in the browser.

Ranking fit for SigLIP 2 @256 (`fit-instance.ts`, global): see `out/instance/ranking-*.json`.

Findings
- The synthetic-edit benchmark (`bench.ts`, RESULTS of 2026-10-07) favoured DINOv2 because it measures the same photo after edits. Another photo of the same object — the lost & found case — is clearly better served by SigLIP 2, which matches ILIAS (CVPR 2025) and the nyris VPS benchmark (2026).
- The automatic object crop from DINOv2 patch PCA did not help (boxes often wrong) — dropped.
- Mirror and 384 px raise the threshold-tier recall but not R@1, at 2–5× the compute; the browser would become too slow.
- Choice: SigLIP 2 B/16 @256, q4 weights, no mirror. Apache-2.0 (google/siglip2-base-patch16-256), ONNX from onnx-community, SHA-256 712064dae0cce3fb4c94497c7dfd65d11f4ad34eadafe09442208474068cf777.

Limits: Objectron frames of one object share the background, so this is a viewpoint test, not a new-place test. A JUYO-specific set (20–30 real items photographed in 2–3 places) is still the best final check.
