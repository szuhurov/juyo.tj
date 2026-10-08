// Copies the in-browser visual-search runtime (ONNX Runtime Web, WASM/CPU)
// from node_modules into public/vendor, so juyo.tj serves it itself and the
// browser never fetches code from a third-party CDN (lib/visual-search.ts
// sets ort.env.wasm.wasmPaths here).
// Runs before `next build` and `next dev`; public/vendor is git-ignored.
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = (...p) => join(root, "node_modules", ...p);
const out = (...p) => join(root, "public", "vendor", ...p);

const files = ["mjs", "wasm"].map((ext) => [
  nm("onnxruntime-web", "dist", `ort-wasm-simd-threaded.${ext}`),
  out("ort", `ort-wasm-simd-threaded.${ext}`),
]);

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
console.log(`[copy-vendor-assets] ${copied} copied, ${files.length - copied} up to date`);
