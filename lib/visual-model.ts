/**
 * The visual-search embedding contract: which model file, which exact
 * preprocessing, which output, which dimension. Every vector in the database
 * carries `id`; vectors of different ids are never compared. Changing ANY
 * field here means a new `id`, a new row in public.visual_models and a
 * backfill — never an in-place change.
 *
 * Chosen by the JUYO benchmark (tools/visual-bench/RESULTS-instance.md).
 * Kept byte-identical in Web/lib and app/lib (app/__tests__/shared-lib-parity.test.ts).
 */
import type { PreprocessSpec } from "./visual-preprocess";

export interface VisualModel {
  id: string;
  file: string;
  sha256: string;
  dim: number;
  /** ONNX output name and how many leading floats of it are the embedding. */
  output: string;
  outputLength: number;
  spec: PreprocessSpec;
}

export const VISUAL_MODEL: VisualModel = {
  // SigLIP 2 B/16 at 256 px (Google, Apache-2.0), onnx-community 4-bit
  // weight-only export of the vision tower; the embedding is the attention-
  // pooled output. Chosen on the real multi-view benchmark (another photo of
  // the same object): R@1 98.6 % vs 88.4 % for DINOv2-S — RESULTS-instance.md.
  id: "siglip2-b16-256-q4.squash-area-v1",
  file: "siglip2-base-256-q4.onnx",
  sha256: "712064dae0cce3fb4c94497c7dfd65d11f4ad34eadafe09442208474068cf777",
  dim: 768,
  output: "pooler_output",
  outputLength: 768,
  spec: { size: 256, mode: "squash", mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5] },
};

/** Served by juyo.tj itself (public/models/visual) — never a third-party CDN. */
export const VISUAL_MODEL_URL = `/models/visual/${VISUAL_MODEL.file}`;
