/**
 * The visual-search embedding contract: which model file, which exact
 * preprocessing, which output, which dimension. Every vector in the database
 * carries `id`; vectors of different ids are never compared. Changing ANY
 * field here means a new `id`, a new row in public.visual_models and a
 * backfill — never an in-place change.
 *
 * Chosen by the JUYO benchmark (tools/visual-bench/RESULTS.md).
 * Kept byte-identical in Web/lib and app/lib (app/__tests__/shared-lib-parity.test.ts).
 */
import type { PreprocessSpec } from "./visual-preprocess";

export interface VisualModel {
  id: string;
  file: string;
  sha256: string;
  dim: number;
  /** ONNX output name and how many leading floats are the embedding (CLS token = first `dim`). */
  output: string;
  outputLength: number;
  spec: PreprocessSpec;
}

export const VISUAL_MODEL: VisualModel = {
  // DINOv2 ViT-S/14 (Meta, Apache-2.0), onnx-community 4-bit weight-only
  // export (activations stay float32, so the vector is stable across
  // decoders: cosine ≥ 0.9988 — RESULTS.md), 280×280 squash, area resampling.
  id: "dinov2-s14-q4.r280-area-v1",
  file: "dinov2-small-q4.onnx",
  sha256: "0f4a7f7d8524f2959407d0f35b09281111bc90c6ed105509290e36da1c669314",
  dim: 384,
  output: "last_hidden_state",
  outputLength: 384,
  spec: { size: 280, mode: "squash", mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
};

/** Served by juyo.tj itself (public/models/visual) — never a third-party CDN. */
export const VISUAL_MODEL_URL = `/models/visual/${VISUAL_MODEL.file}`;
