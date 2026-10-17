import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ORT_WASM_BYTES, VISUAL_MODEL_BYTES } from "@/lib/visual-search";

// The install progress relies on these sizes (the server sends the files
// compressed, without a length): they must match the files we serve.
describe("search-by-photo install sizes", () => {
  it("match the model and runtime files in public/", () => {
    const pub = path.resolve(__dirname, "../../public");
    expect(fs.statSync(path.join(pub, "models/visual/siglip2-base-256-q4.onnx")).size).toBe(VISUAL_MODEL_BYTES);
    expect(fs.statSync(path.join(pub, "vendor/ort/ort-wasm-simd-threaded.wasm")).size).toBe(ORT_WASM_BYTES);
  });
});
