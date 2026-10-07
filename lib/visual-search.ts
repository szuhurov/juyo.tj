/**
 * Visual search in the browser: the photo is turned into a vector HERE
 * (ONNX Runtime Web, WASM, CPU) and only that vector + a 64-bit pHash are
 * sent to /api/search/image. The photo itself never leaves the device for
 * search. The model file, the WASM runtime and its loader are all served by
 * juyo.tj (public/models/visual, public/vendor/ort — no CDN), and the model's
 * SHA-256 is checked before it is ever run.
 *
 * Mobile does the same with the native module (app/lib/visual-search.ts);
 * both share lib/visual-model.ts and lib/visual-preprocess.ts.
 */
import { VISUAL_MODEL, VISUAL_MODEL_URL } from "@/lib/visual-model";
import { l2normalize, pHash, toTensor, type Pixels } from "@/lib/visual-preprocess";

type Ort = typeof import("onnxruntime-web");
type Session = import("onnxruntime-web").InferenceSession;

const ORT_BASE = "/vendor/ort/";
const CACHE = "juyo-visual-models";
const MAX_PIXELS = 60_000_000;

export interface PhotoEmbedding {
  model: string;
  vector: number[];
  phash: string;
}

let sessionP: Promise<{ ort: Ort; session: Session }> | null = null;

async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The pinned model bytes: from Cache Storage when present, verified every time. */
async function modelBytes(): Promise<ArrayBuffer> {
  const cache = typeof caches !== "undefined" ? await caches.open(CACHE).catch(() => null) : null;
  const cached = await cache?.match(VISUAL_MODEL_URL);
  if (cached) {
    const bytes = await cached.arrayBuffer();
    if ((await sha256Hex(bytes)) === VISUAL_MODEL.sha256) return bytes;
    await cache?.delete(VISUAL_MODEL_URL);
  }
  const res = await fetch(VISUAL_MODEL_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`model ${res.status}`);
  const bytes = await res.arrayBuffer();
  // Never run a model that is not exactly the pinned file.
  if ((await sha256Hex(bytes)) !== VISUAL_MODEL.sha256) throw new Error("model checksum mismatch");
  await cache?.put(VISUAL_MODEL_URL, new Response(bytes.slice(0), { headers: { "content-type": "application/octet-stream" } })).catch(() => {});
  return bytes;
}

function getSession() {
  sessionP ??= (async () => {
    const ort = await import("onnxruntime-web/wasm");
    ort.env.wasm.wasmPaths = ORT_BASE;
    // juyo.tj is not cross-origin isolated, so WASM threads are unavailable;
    // asking for them only logs a warning.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    const session = await ort.InferenceSession.create(await modelBytes(), { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
    return { ort: ort as unknown as Ort, session };
  })().catch((e) => {
    sessionP = null;
    throw e;
  });
  return sessionP;
}

/** Starts the (≈ one-time) model download early, e.g. when the search dialog opens. */
export function warmUpVisualModel() {
  getSession().catch(() => {});
}

/** Upright (EXIF applied), sRGB, full-resolution pixels — the only browser-specific step. */
async function decode(source: Blob): Promise<Pixels> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image", colorSpaceConversion: "default", premultiplyAlpha: "none" });
  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS) throw new Error("Image too large");
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" });
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height, { colorSpace: "srgb" });
    return { data: img.data, width: img.width, height: img.height, channels: 4 };
  } finally {
    bitmap.close();
  }
}

/** Vector + pHash of a photo, computed in this browser. */
export async function embedPhoto(source: Blob): Promise<PhotoEmbedding> {
  const [{ ort, session }, px] = await Promise.all([getSession(), decode(source)]);
  const n = VISUAL_MODEL.spec.size;
  const input = new ort.Tensor("float32", toTensor(px, VISUAL_MODEL.spec), [1, 3, n, n]);
  const out = await session.run({ [session.inputNames[0]]: input });
  const raw = out[VISUAL_MODEL.output].data as Float32Array;
  return {
    model: VISUAL_MODEL.id,
    vector: l2normalize(raw.subarray(0, VISUAL_MODEL.outputLength || raw.length)),
    phash: pHash(px),
  };
}

/** Same for a published photo URL (admin review). */
export async function embedPhotoUrl(url: string): Promise<PhotoEmbedding> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`photo ${res.status}`);
  return embedPhoto(await res.blob());
}

/**
 * Poster's browser: sends the vectors of the photos it just uploaded.
 * Best effort — the listing never waits for or fails on this; the admin's
 * browser recomputes every vector at review anyway.
 */
export async function attachEmbeddings(
  db: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }> },
  rows: { id: string; image_url: string }[],
  files: Map<string, Blob>,
) {
  for (const row of rows) {
    const file = files.get(row.image_url);
    if (!file) continue;
    try {
      const e = await embedPhoto(file);
      await db.rpc("set_image_embedding", { p_image_id: row.id, p_model: e.model, p_embedding: e.vector, p_phash: e.phash });
    } catch {
      // see above: never blocks or fails the listing
    }
  }
}
