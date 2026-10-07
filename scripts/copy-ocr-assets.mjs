// Copies the in-browser photo privacy and visual-search runtime files
// from node_modules into public/vendor, so juyo.tj serves them itself and the
// browser never fetches code or models from a third-party CDN.
// Runs before `next build` and `next dev`; public/vendor is git-ignored.
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = (...p) => join(root, "node_modules", ...p);
const out = (...p) => join(root, "public", "vendor", ...p);

const files = [
  // tesseract.js worker and the LSTM-only cores (lib/document-detection.ts
  // creates the worker with OEM.LSTM_ONLY; the worker picks one by CPU support).
  [nm("tesseract.js", "dist", "worker.min.js"), out("ocr", "worker.min.js")],
  ...["lstm", "simd-lstm", "relaxedsimd-lstm"].map((v) => [
    nm("tesseract.js-core", `tesseract-core-${v}.wasm.js`),
    out("ocr", "core", `tesseract-core-${v}.wasm.js`),
  ]),
  // Language models (LSTM, integer) — Russian covers Cyrillic incl. most Tajik letters.
  ...["rus", "eng"].map((lang) => [
    nm("@tesseract.js-data", lang, "4.0.0_best_int", `${lang}.traineddata.gz`),
    out("ocr", "lang", `${lang}.traineddata.gz`),
  ]),
  // QR/barcode reader (zxing-cpp compiled to WASM). lib/photo-privacy.ts
  // points zxing-wasm here instead of its default CDN.
  [nm("zxing-wasm", "dist", "reader", "zxing_reader.wasm"), out("zxing", "zxing_reader.wasm")],
  // MediaPipe vision runtime (SIMD and fallback builds).
  ...["vision_wasm_internal", "vision_wasm_nosimd_internal"].flatMap((name) =>
    ["js", "wasm"].map((ext) => [
      nm("@mediapipe", "tasks-vision", "wasm", `${name}.${ext}`),
      out("mediapipe", `${name}.${ext}`),
    ]),
  ),
  // ONNX Runtime Web (WASM, CPU) for visual search (lib/visual-search.ts
  // sets ort.env.wasm.wasmPaths here, so it never fetches from a CDN).
  ...["mjs", "wasm"].map((ext) => [
    nm("onnxruntime-web", "dist", `ort-wasm-simd-threaded.${ext}`),
    out("ort", `ort-wasm-simd-threaded.${ext}`),
  ]),
];

let copied = 0;
for (const [from, to] of files) {
  const size = statSync(from).size;
  try {
    if (statSync(to).size === size) continue;
  } catch {
    // not copied yet
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  copied++;
}
console.log(`[copy-ocr-assets] ${copied} copied, ${files.length - copied} up to date`);
