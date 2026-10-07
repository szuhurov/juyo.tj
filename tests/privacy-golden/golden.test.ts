// @vitest-environment node
/**
 * Golden privacy suite (npm run test:privacy). Runs the REAL detection
 * engines the website uses — tesseract.js with the same self-hosted models
 * (public/vendor/ocr/lang) and zxing-wasm — plus the shared decision code
 * (lib/privacy-pipeline.ts) and the same mappers (lib/photo-privacy.ts) on
 * golden images with known secrets. Then it does what the app does:
 * covers the suggestions, re-detects on the covered image (findLeaks) and
 * covers again until clean; finally an independent OCR + barcode read of
 * the result must not reveal any secret.
 *
 * Not covered here: the face detector (MediaPipe runs only in a browser)
 * and the native iOS/Android engines — see docs in the report printed at
 * the end, and the detection-level cases in tests/lib/privacy-cases.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import {
  ANALYZE_MAX_SIDE,
  BARCODE_READER_OPTIONS,
  barcodeBoxesFromResults,
  textLinesFromBlocks,
} from "@/lib/photo-privacy";
import { assessPhoto, findLeaks, type PhotoDetections, type Rect } from "@/lib/privacy-pipeline";
import { buildGoldenImages, type GoldenImage } from "./fixtures";

const ROOT = path.resolve(__dirname, "../..");
let worker: Worker;

beforeAll(async () => {
  worker = await createWorker(["rus", "eng"], OEM.LSTM_ONLY, {
    langPath: path.join(ROOT, "public/vendor/ocr/lang"),
    gzip: true,
    cacheMethod: "none",
  });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  await prepareZXingModule({
    overrides: { wasmBinary: (await readFile(path.join(ROOT, "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm"))).buffer as ArrayBuffer },
    fireImmediately: true,
  });
}, 120_000);

afterAll(async () => {
  await worker?.terminate();
});

/** Upright, at most ANALYZE_MAX_SIDE, metadata-free — the same normalization as the apps. */
async function normalize(bytes: Buffer) {
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize({ width: ANALYZE_MAX_SIDE, height: ANALYZE_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { png: data, width: info.width, height: info.height };
}

async function analyze(bytes: Buffer): Promise<PhotoDetections> {
  const img = await normalize(bytes);
  const { data } = await worker.recognize(img.png, {}, { blocks: true, text: false });
  const codes = await readBarcodes(new Uint8Array(img.png), BARCODE_READER_OPTIONS);
  return {
    width: img.width,
    height: img.height,
    textLines: textLinesFromBlocks(data.blocks, img.width, img.height),
    textRegions: [],
    faces: [],
    barcodes: barcodeBoxesFromResults(codes, img.width, img.height),
    documents: [],
    // Faces are not measured in Node (see the header); treat the detector as run.
    ran: { text: true, faces: true, barcodes: true, documents: false },
  };
}

async function paint(bytes: Buffer, rects: Rect[]): Promise<Buffer> {
  const img = await normalize(bytes);
  if (rects.length === 0) return img.png;
  const boxes = rects.map((r) => {
    const x0 = Math.floor(r.x * img.width);
    const y0 = Math.floor(r.y * img.height);
    return `<rect x="${x0}" y="${y0}" width="${Math.ceil((r.x + r.width) * img.width) - x0}" height="${Math.ceil((r.y + r.height) * img.height) - y0}" fill="#141414"/>`;
  }).join("");
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${img.width}" height="${img.height}">${boxes}</svg>`);
  return sharp(img.png).composite([{ input: overlay }]).png().toBuffer();
}

const LOOK: Record<string, string> = { А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X", У: "Y" };
const norm = (s: string) => s.toUpperCase().replace(/[АВЕКМНОРСТХУ]/g, (c) => LOOK[c]).replace(/[\s.\-+()]/g, "");

/** An independent read of the final image, at full and 2× size and rotated, so small or turned text is not missed. */
async function readEverything(bytes: Buffer) {
  const texts: string[] = [];
  for (const variant of [bytes, await sharp(bytes).resize({ width: 2400 }).toBuffer(), await sharp(bytes).rotate(90).toBuffer(), await sharp(bytes).rotate(-12, { background: "#fff" }).toBuffer()]) {
    const { data } = await worker.recognize(variant, {}, { text: true });
    texts.push(norm(data.text ?? ""));
  }
  const codes = await readBarcodes(new Uint8Array(await sharp(bytes).png().toBuffer()), BARCODE_READER_OPTIONS);
  return { text: texts.join("|"), codes: codes.filter((c) => c.isValid).map((c) => c.text) };
}

interface Row {
  name: string;
  decision: string;
  document: boolean;
  expectedDocument: boolean;
  covers: number;
  validationRounds: number;
  leaked: string[];
  codesLeaked: string[];
  keptLost: string[];
  ms: number;
}
const rows: Row[] = [];

async function run(g: GoldenImage): Promise<Row> {
  const started = Date.now();
  const first = await analyze(g.bytes);
  const assessment = assessPhoto(first, { category: g.category });
  // Auto-covered, or (review) the person confirms the pre-filled covers unchanged.
  let out = await paint(g.bytes, assessment.regions);
  let applied: Rect[] = assessment.regions.slice();
  let rounds = 0;
  for (; rounds < 3; rounds++) {
    const leaks = findLeaks(await analyze(out), applied, { category: g.category });
    if (leaks.length === 0) break;
    out = await paint(out, leaks);
    applied = [...applied, ...leaks];
  }
  const ms = Date.now() - started;
  const read = await readEverything(out);
  return {
    name: g.name,
    decision: assessment.decision,
    document: assessment.documentLike,
    expectedDocument: !!g.document,
    covers: applied.length,
    validationRounds: rounds,
    leaked: g.secrets.filter((s) => read.text.includes(norm(s))),
    codesLeaked: (g.codes ?? []).filter((c) => read.codes.some((t) => t.includes(c))),
    keptLost: [...(g.keep ?? []).filter((k) => !read.text.includes(norm(k))), ...(g.keepCodes ?? []).filter((c) => !read.codes.includes(c))],
    ms,
  };
}

const images = await buildGoldenImages();

describe("golden privacy images", () => {
  it("negative control: without covers the checker does read the secrets", async () => {
    for (const g of images.filter((x) => ["passport", "bank_card", "contact_note", "qr_codes"].includes(x.name))) {
      const read = await readEverything(await (await normalize(g.bytes)).png);
      expect(g.secrets.some((s) => read.text.includes(norm(s))) || (g.codes ?? []).some((c) => read.codes.some((t) => t.includes(c))), g.name).toBe(true);
    }
  }, 300_000);

  for (const g of images) {
    it(g.name, async () => {
      const row = await run(g);
      rows.push(row);
      expect(row.leaked, "secret readable in the uploaded image").toEqual([]);
      expect(row.codesLeaked, "code still decodable").toEqual([]);
      if (g.document) expect(row.decision, "documents always need the person's check").toBe("review_required");
    }, 300_000);
  }

  afterAll(() => {
    const secrets = images.reduce((n, g) => n + g.secrets.length, 0);
    const leaked = rows.reduce((n, r) => n + r.leaked.length, 0);
    const codes = images.reduce((n, g) => n + (g.codes?.length ?? 0), 0);
    const codesLeaked = rows.reduce((n, r) => n + r.codesLeaked.length, 0);
    const docs = rows.filter((r) => r.expectedDocument);
    const nonDocs = rows.filter((r) => !r.expectedDocument);
    const keep = images.reduce((n, g) => n + (g.keep?.length ?? 0) + (g.keepCodes?.length ?? 0), 0);
    const keptLost = rows.reduce((n, r) => n + r.keptLost.length, 0);
    const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "n/a");
    const table = rows.map((r) => [
      r.name.padEnd(30), r.decision.padEnd(16), `doc=${r.document}`.padEnd(10), `covers=${r.covers}`.padEnd(10),
      `rounds=${r.validationRounds}`.padEnd(9), `${r.ms}ms`.padEnd(8),
      `leaked=${r.leaked.join("|") || "-"}`, `codes=${r.codesLeaked.join("|") || "-"}`, `keptLost=${r.keptLost.join("|") || "-"}`,
    ].join(" "));
    process.stdout.write(`\n${table.join("\n")}\n`);
    process.stdout.write([
      "── privacy metrics (web engines, Node) ──",
      `sensitive-text recall: ${pct(secrets - leaked, secrets)}  (${leaked}/${secrets} secrets readable = false-negative rate ${pct(leaked, secrets)})`,
      `code recall: ${pct(codes - codesLeaked, codes)}  (${codesLeaked}/${codes} decodable)`,
      `document detection recall: ${pct(docs.filter((r) => r.document).length, docs.length)}  (category-forced included)`,
      `document false positives: ${nonDocs.filter((r) => r.document).length}/${nonDocs.length}`,
      `harmless content lost (false-positive covers): ${pct(keptLost, keep)}  (${keptLost}/${keep})`,
      `processing time per image (detect + cover + validate): median ${median(rows.map((r) => r.ms))} ms, max ${Math.max(...rows.map((r) => r.ms))} ms`,
    ].join("\n"));
  });
});

function median(xs: number[]) {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}
