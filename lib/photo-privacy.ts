/**
 * The browser half of the photo privacy pipeline (lib/privacy-pipeline.ts
 * holds the shared decisions; app/lib/photo-privacy.ts is the mobile half).
 *
 * Detectors, all running in the person's browser:
 *   - text + OCR: tesseract.js (LSTM, rus+eng)
 *   - faces + eyes: MediaPipe BlazeFace short-range
 *   - QR / barcodes: zxing-wasm (zxing-cpp)
 * Every worker, WASM and model file is served from juyo.tj itself
 * (/vendor, /models — scripts/copy-ocr-assets.mjs); zxing-wasm's default
 * CDN download is overridden below. No photo, no detection result and no
 * request about the photo leaves the device; uploads only ever receive the
 * file this module calls safe.
 */
import {
  assessPhoto,
  findLeaks,
  type BarcodeBox,
  type FaceBox,
  type PhotoDetections,
  type PrivacyAssessment,
  type Rect,
  type TextLine,
} from "@/lib/privacy-pipeline";

type TesseractWorker = import("tesseract.js").Worker;
type MediaPipeFaceDetector = import("@mediapipe/tasks-vision").FaceDetector;
type ReadBarcodes = typeof import("zxing-wasm/reader").readBarcodes;

const OCR_BASE = "/vendor/ocr";
const MEDIAPIPE_WASM = "/vendor/mediapipe";
const FACE_MODEL = "/models/blaze_face_short_range.tflite";
const ZXING_BASE = "/vendor/zxing";

/** Detection resolution: small print on a whole card stays readable; memory stays bounded. */
export const ANALYZE_MAX_SIDE = 2000;
/** Refuse anything that decodes to more pixels than a real phone photo. */
const MAX_PIXELS = 60_000_000;
const COVER_COLOR = "#141414";

export type ProtectedPhoto =
  /** May be uploaded. `covers` are the painted areas (empty for a clean photo). */
  | { status: "safe"; file: File; covers: Rect[]; assessment: PrivacyAssessment | null }
  /** Must be checked by the person in the privacy editor first; `assessment.regions` are the suggested covers. */
  | { status: "review"; file: File; assessment: PrivacyAssessment }
  /** Refused outright (a photo of a person): never uploaded, not even covered. */
  | { status: "blocked"; file: File; assessment: PrivacyAssessment };

const NOTHING_RAN: PhotoDetections = {
  width: 0,
  height: 0,
  textLines: [],
  textRegions: [],
  faces: [],
  barcodes: [],
  documents: [],
  ran: { text: false, faces: false, barcodes: false, documents: false },
};

// ── engines (lazy, cached) ────────────────────────────────────────────

let ocrWorker: Promise<TesseractWorker> | null = null;
let faceDetector: Promise<MediaPipeFaceDetector> | null = null;
let barcodeReader: Promise<ReadBarcodes> | null = null;

function retryable<T>(make: () => Promise<T>, reset: () => void): Promise<T> {
  return make().catch((e) => {
    reset();
    throw e;
  });
}

function getOcrWorker() {
  ocrWorker ??= retryable(async () => {
    const { createWorker, OEM, PSM } = await import("tesseract.js");
    const worker = await createWorker(["rus", "eng"], OEM.LSTM_ONLY, {
      workerPath: `${OCR_BASE}/worker.min.js`,
      corePath: `${OCR_BASE}/core`,
      langPath: `${OCR_BASE}/lang`,
      gzip: true,
      workerBlobURL: false,
    });
    // Documents and labels are fields scattered over a card, not paragraphs.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    return worker;
  }, () => { ocrWorker = null; });
  return ocrWorker;
}

function getFaceDetector() {
  faceDetector ??= retryable(async () => {
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
    return FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: "CPU" },
      runningMode: "IMAGE",
      // Lower than MediaPipe's default: a missed face is worse than a covered patch.
      minDetectionConfidence: 0.4,
    });
  }, () => { faceDetector = null; });
  return faceDetector;
}

function getBarcodeReader() {
  barcodeReader ??= retryable(async () => {
    const { prepareZXingModule, readBarcodes } = await import("zxing-wasm/reader");
    // Self-hosted WASM: without this override zxing-wasm downloads it from a CDN.
    await prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `${ZXING_BASE}/${path}` : prefix + path) },
      fireImmediately: true,
    });
    return readBarcodes;
  }, () => { barcodeReader = null; });
  return barcodeReader;
}

// ── normalization ─────────────────────────────────────────────────────

/**
 * Decodes upright (EXIF orientation applied by the browser) into a canvas
 * no larger than `maxSide`. All detector coordinates refer to this canvas,
 * normalized to 0..1, so they map onto any size of the same image.
 */
async function decodeUpright(source: Blob, maxSide?: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS) throw new Error("Image too large");
    const scale = maxSide ? Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height)) : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

// ── detectors ─────────────────────────────────────────────────────────

type OcrBlocks = Awaited<ReturnType<TesseractWorker["recognize"]>>["data"]["blocks"];

/** Tesseract's line boxes as normalized TextLines (shared with tests/privacy-golden). */
export function textLinesFromBlocks(blocks: OcrBlocks, width: number, height: number): TextLine[] {
  const lines: TextLine[] = [];
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const { x0, y0, x1, y1 } = line.bbox;
        lines.push({
          text: line.text.trim(),
          confidence: typeof line.confidence === "number" ? line.confidence / 100 : -1,
          x: x0 / width,
          y: y0 / height,
          width: (x1 - x0) / width,
          height: (y1 - y0) / height,
        });
      }
    }
  }
  return lines;
}

async function detectText(canvas: HTMLCanvasElement): Promise<TextLine[]> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false });
  return textLinesFromBlocks(data.blocks, canvas.width, canvas.height);
}

// BlazeFace short-range expects a face that fills a good part of the frame;
// on a photo of a whole document the portrait (or a bystander) is small, so
// the detector also looks at overlapping half-size and third-size crops
// ([x, y, size]).
const CROPS: [number, number, number][] = [[0, 0, 1]];
for (const y of [0, 0.25, 0.5]) for (const x of [0, 0.25, 0.5]) CROPS.push([x, y, 0.5]);
for (const y of [0, 0.22, 0.44, 0.66]) for (const x of [0, 0.22, 0.44, 0.66]) CROPS.push([x, y, 0.34]);

function overlaps(a: Rect, b: Rect) {
  const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return ix * iy > 0.3 * Math.min(a.width * a.height, b.width * b.height);
}

async function detectFaces(canvas: HTMLCanvasElement): Promise<FaceBox[]> {
  const detector = await getFaceDetector();
  const faces: FaceBox[] = [];
  const crop = document.createElement("canvas");
  for (const [fx, fy, size] of CROPS) {
    const sx = fx * canvas.width;
    const sy = fy * canvas.height;
    const sw = size * canvas.width;
    const sh = size * canvas.height;
    crop.width = Math.max(1, Math.round(sw));
    crop.height = Math.max(1, Math.round(sh));
    crop.getContext("2d")?.drawImage(canvas, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
    for (const detection of detector.detect(crop).detections) {
      const box = detection.boundingBox;
      if (!box) continue;
      const kx = sw / crop.width;
      const ky = sh / crop.height;
      const face: FaceBox = {
        x: (sx + box.originX * kx) / canvas.width,
        y: (sy + box.originY * ky) / canvas.height,
        width: (box.width * kx) / canvas.width,
        height: (box.height * ky) / canvas.height,
        confidence: detection.categories[0]?.score ?? 0,
        eyes: null,
      };
      const [right, left] = detection.keypoints;
      if (right && left) {
        // Keypoints are normalized to the crop; work in pixels so the bar keeps its shape.
        const cx = sx + ((right.x + left.x) / 2) * sw;
        const cy = sy + ((right.y + left.y) / 2) * sh;
        const d = Math.hypot((left.x - right.x) * sw, (left.y - right.y) * sh);
        // Approximates the outer corners of both eyes; the pipeline adds the margin.
        face.eyes = {
          x: (cx - d * 0.75) / canvas.width,
          y: (cy - d * 0.125) / canvas.height,
          width: (d * 1.5) / canvas.width,
          height: (d * 0.25) / canvas.height,
        };
      }
      if (!faces.some((f) => overlaps(f, face))) faces.push(face);
    }
  }
  return faces;
}

const MATRIX_FORMAT = /qr|matrix|aztec|pdf\s*417|maxi/i;

export const BARCODE_READER_OPTIONS = {
  formats: [],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  maxNumberOfSymbols: 16,
};

type BarcodeResults = Awaited<ReturnType<ReadBarcodes>>;

/** zxing results as normalized BarcodeBoxes (shared with tests/privacy-golden). */
export function barcodeBoxesFromResults(results: BarcodeResults, width: number, height: number): BarcodeBox[] {
  return results.filter((r) => r.isValid).map((r) => {
    const p = r.position;
    const xs = [p.topLeft.x, p.topRight.x, p.bottomLeft.x, p.bottomRight.x];
    const ys = [p.topLeft.y, p.topRight.y, p.bottomLeft.y, p.bottomRight.y];
    let x0 = Math.min(...xs);
    let x1 = Math.max(...xs);
    let y0 = Math.min(...ys);
    let y1 = Math.max(...ys);
    if (!MATRIX_FORMAT.test(r.format)) {
      // Linear codes are located on their scan lines: grow to the bars' likely height.
      const len = Math.max(x1 - x0, y1 - y0);
      const cy = (y0 + y1) / 2;
      y0 = Math.min(y0, cy - len * 0.4);
      y1 = Math.max(y1, cy + len * 0.4);
      x0 -= len * 0.1;
      x1 += len * 0.1;
    }
    return {
      x: x0 / width,
      y: y0 / height,
      width: (x1 - x0) / width,
      height: (y1 - y0) / height,
      format: r.format,
      payload: r.text || null,
    };
  });
}

async function detectBarcodes(canvas: HTMLCanvasElement): Promise<BarcodeBox[]> {
  const readBarcodes = await getBarcodeReader();
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const results = await readBarcodes(ctx.getImageData(0, 0, canvas.width, canvas.height), BARCODE_READER_OPTIONS);
  return barcodeBoxesFromResults(results, canvas.width, canvas.height);
}

/** Runs every detector; one that fails is reported as not run (→ the person must review). */
export async function analyzeCanvas(canvas: HTMLCanvasElement): Promise<PhotoDetections> {
  const settle = async <T>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (e) {
      // Never log the photo or anything read from it.
      console.warn("[photo-privacy] detector failed:", e instanceof Error ? e.name : "unknown");
      return null;
    }
  };
  const [textLines, faces, barcodes] = await Promise.all([
    settle(detectText(canvas)),
    settle(detectFaces(canvas)),
    settle(detectBarcodes(canvas)),
  ]);
  return {
    width: canvas.width,
    height: canvas.height,
    textLines: textLines ?? [],
    textRegions: [],
    faces: faces ?? [],
    barcodes: barcodes ?? [],
    documents: [],
    ran: { text: textLines !== null, faces: faces !== null, barcodes: barcodes !== null, documents: false },
  };
}

// One analysis per file, started as soon as it is picked (warmPhotoAnalysis).
const analyses = new WeakMap<Blob, Promise<PhotoDetections | null>>();

export function analyzePhoto(file: Blob): Promise<PhotoDetections | null> {
  let pending = analyses.get(file);
  if (!pending) {
    pending = decodeUpright(file, ANALYZE_MAX_SIDE)
      .then(analyzeCanvas)
      .catch((e) => {
        console.warn("[photo-privacy] analysis failed:", e instanceof Error ? e.name : "unknown");
        analyses.delete(file);
        return null;
      });
    analyses.set(file, pending);
  }
  return pending;
}

/** Starts the analysis in the background (call right after a photo is picked). */
export function warmPhotoAnalysis(file: Blob) {
  void analyzePhoto(file);
}

// ── covering ──────────────────────────────────────────────────────────

/**
 * Paints solid covers over `rects` and re-encodes. The pixels under a cover
 * are gone (not blurred), and the canvas re-encode carries no EXIF/GPS.
 */
export async function paintCovers(file: Blob, rects: Rect[], name: string): Promise<File> {
  const canvas = await decodeUpright(file);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = COVER_COLOR;
  for (const r of rects) {
    // Round outwards so no edge pixel of the covered area survives.
    const x0 = Math.floor(r.x * canvas.width);
    const y0 = Math.floor(r.y * canvas.height);
    const x1 = Math.ceil((r.x + r.width) * canvas.width);
    const y1 = Math.ceil((r.y + r.height) * canvas.height);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Image encoding failed");
  return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
}

const MAX_ROUNDS = 3;

/**
 * Covers `covers` (unless `painted` — the editor already baked them in),
 * then validates the result: the detectors run again on the exact file
 * that would be uploaded, and anything sensitive still visible is covered
 * too, up to MAX_ROUNDS times. A photo that still shows something after
 * that is sent back for review rather than uploaded.
 *
 * `painted` photos come from the privacy editor, where the person already
 * looked at them: if detection is unavailable there, their manual check
 * stands (an admin still reviews every listing).
 */
export async function finalizePhoto(file: File, covers: Rect[], category: string | null | undefined, painted = false): Promise<ProtectedPhoto> {
  let current = painted || covers.length === 0 ? file : await paintCovers(file, covers, file.name);
  let applied = covers.slice();
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const after = await analyzePhoto(current);
    if (!after) {
      if (painted) return { status: "safe", file: current, covers: applied, assessment: null };
      return { status: "review", file, assessment: assessPhoto(NOTHING_RAN, { category }) };
    }
    const leaks = findLeaks(after, applied, { category });
    if (leaks.length === 0) return { status: "safe", file: current, covers: applied, assessment: assessPhoto(after, { category }) };
    current = await paintCovers(current, leaks, file.name);
    applied = [...applied, ...leaks];
  }
  const last = await analyzePhoto(current);
  return { status: "review", file: current, assessment: assessPhoto(last ?? NOTHING_RAN, { category }) };
}

/**
 * The whole pipeline for one photo: detect → decide → cover → validate.
 * Never throws for a detection problem — an unavailable or failed
 * detector means the person has to review the photo.
 */
export async function protectPhoto(file: File, category: string | null | undefined): Promise<ProtectedPhoto> {
  const detections = await analyzePhoto(file);
  const assessment = assessPhoto(detections ?? NOTHING_RAN, { category });
  if (assessment.decision === "blocked") return { status: "blocked", file, assessment };
  if (assessment.decision === "review_required") return { status: "review", file, assessment };
  if (assessment.decision === "clean") return { status: "safe", file, covers: [], assessment };
  try {
    return await finalizePhoto(file, assessment.regions, category);
  } catch (e) {
    console.warn("[photo-privacy] covering failed:", e instanceof Error ? e.name : "unknown");
    return { status: "review", file, assessment };
  }
}

/** Suggested covers for the privacy editor (null when detection is unavailable). */
export async function suggestCovers(file: File, category: string | null | undefined, documentMode: boolean): Promise<Rect[] | null> {
  const detections = await analyzePhoto(file);
  if (!detections) return null;
  // The editor's "document" mode is the Documents/Cards rules, whatever the listing category.
  return assessPhoto(detections, { category: documentMode ? "Documents" : category }).regions;
}

/** Axis-aligned box around a rotated editor region (rotation in degrees, about its centre). */
export function boundingRect(r: Rect & { rotation?: number }, aspect: number): Rect {
  if (!r.rotation) return { x: r.x, y: r.y, width: r.width, height: r.height };
  // Rotate in pixel-proportional space so a non-square photo keeps the right shape.
  const a = (r.rotation * Math.PI) / 180;
  const w = r.width * aspect;
  const h = r.height;
  const bw = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
  const bh = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  return { x: cx - bw / aspect / 2, y: cy - bh / 2, width: bw / aspect, height: bh };
}
