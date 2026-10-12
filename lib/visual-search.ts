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

/** Share of the model file downloaded so far (0–1); null when nothing is downloading. */
let downloadProgress: number | null = null;
const progressListeners = new Set<(p: number | null) => void>();
function setDownloadProgress(p: number | null) {
  downloadProgress = p;
  progressListeners.forEach((l) => l(p));
}
/** The first search downloads the model (tens of MB); the dialog shows how far it is. */
export function onVisualModelDownload(listener: (p: number | null) => void) {
  progressListeners.add(listener);
  listener(downloadProgress);
  return () => { progressListeners.delete(listener); };
}

async function readWithProgress(res: Response): Promise<ArrayBuffer> {
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !total) return res.arrayBuffer();
  const chunks: Uint8Array[] = [];
  const reader = res.body.getReader();
  let got = 0;
  setDownloadProgress(0);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      // A compressed response delivers more bytes than its content-length.
      setDownloadProgress(Math.min(1, got / total));
    }
  } finally {
    setDownloadProgress(null);
  }
  const bytes = new Uint8Array(got);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes.buffer;
}

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
  const bytes = await readWithProgress(res);
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

/** Loads the model into memory early. Downloads it if it is not installed yet — check visualModelInstalled() first. */
export function warmUpVisualModel() {
  getSession().catch(() => {});
}

/** Shown on the install prompt, so the person knows what the download costs. */
export const VISUAL_MODEL_SIZE_MB = 64;

/** True when the model is already in this browser (no download needed). */
export async function visualModelInstalled() {
  if (sessionP) return true;
  try {
    return !!(await (await caches.open(CACHE)).match(VISUAL_MODEL_URL));
  } catch {
    return false;
  }
}

/** Downloads (with progress — onVisualModelDownload), verifies and loads the model. */
export async function installVisualModel() {
  await getSession();
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
