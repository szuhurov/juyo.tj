// @vitest-environment node
/**
 * Real-photo privacy check (developer only). Same engines and code path as
 * golden.test.ts, but on REAL photos that never enter the repository:
 *
 *   JUYO_REAL_DOCS=<folder with photos>
 *   JUYO_REAL_SECRETS=<json: [{ file, category, secrets: [] }]>
 *   JUYO_REAL_OUT=<folder for the covered results>
 *   npx vitest run --config vitest.privacy.config.ts tests/privacy-golden/real-docs.test.ts
 *
 * Every photo runs twice: with the category the poster would choose, and as
 * "Other" (a document posted under the wrong category). The covered result
 * is written to JUYO_REAL_OUT for a human look, and an independent OCR +
 * barcode read must not find any listed secret. Skipped when the variables
 * are not set. Faces are not measured in Node (MediaPipe needs a browser).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

const DOCS = process.env.JUYO_REAL_DOCS;
const SECRETS = process.env.JUYO_REAL_SECRETS;
const OUT = process.env.JUYO_REAL_OUT;
const ROOT = path.resolve(__dirname, "../..");

interface Case { file: string; category: string; secrets: string[] }
const cases: Case[] = DOCS && SECRETS ? JSON.parse(await readFile(SECRETS, "utf8")) : [];
let worker: Worker;

const LOOK: Record<string, string> = { А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X", У: "Y" };
const norm = (s: string) => s.toUpperCase().replace(/[АВЕКМНОРСТХУ]/g, (c) => LOOK[c]).replace(/[\s.\-+()]/g, "");

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

/** Independent read: as is, 2×, both 90° turns and upside down, so turned cards are read too. */
async function readEverything(bytes: Buffer) {
  const texts: string[] = [];
  const variants = [
    bytes,
    await sharp(bytes).resize({ width: 2400 }).toBuffer(),
    await sharp(bytes).rotate(90).toBuffer(),
    await sharp(bytes).rotate(-90).toBuffer(),
    await sharp(bytes).rotate(180).toBuffer(),
  ];
  for (const v of variants) {
    const { data } = await worker.recognize(v, {}, { text: true });
    texts.push(norm(data.text ?? ""));
  }
  const codes = await readBarcodes(new Uint8Array(await sharp(bytes).png().toBuffer()), BARCODE_READER_OPTIONS);
  return { text: texts.join("|"), codes: codes.filter((c) => c.isValid).map((c) => c.text) };
}

const report: string[] = [];

describe.skipIf(cases.length === 0)("real document photos", () => {
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
    if (OUT) await mkdir(OUT, { recursive: true });
  }, 120_000);

  afterAll(async () => {
    await worker?.terminate();
    process.stdout.write(`\n${report.join("\n")}\n`);
  });

  cases.forEach((c, i) => {
    for (const category of [c.category, "Other"]) {
      it(`${String(i + 1).padStart(2, "0")} ${category}`, async () => {
        const started = Date.now();
        const bytes = await readFile(path.join(DOCS!, c.file));
        const before = await readEverything((await normalize(bytes)).png);
        const readableBefore = c.secrets.filter((s) => before.text.includes(norm(s)));

        const first = await analyze(bytes);
        const a = assessPhoto(first, { category });
        let out = await paint(bytes, a.regions);
        let applied: Rect[] = a.regions.slice();
        for (let round = 0; round < 3; round++) {
          const leaks = findLeaks(await analyze(out), applied, { category });
          if (leaks.length === 0) break;
          out = await paint(out, leaks);
          applied = [...applied, ...leaks];
        }
        const after = await readEverything(out);
        const leaked = c.secrets.filter((s) => after.text.includes(norm(s)));
        if (OUT) await writeFile(path.join(OUT, `${String(i + 1).padStart(2, "0")}-${category}.jpg`), await sharp(out).resize({ width: 1400, height: 1400, fit: "inside" }).jpeg({ quality: 80 }).toBuffer());
        report.push([
          `${String(i + 1).padStart(2, "0")}`, category.padEnd(9), a.decision.padEnd(16), `doc=${a.documentLike}`.padEnd(10),
          `covers=${applied.length}`.padEnd(10), `readableBefore=${readableBefore.length}/${c.secrets.length}`.padEnd(18),
          `leaked=${leaked.join("|") || "-"}`, `codesAfter=${after.codes.length}`, `${Date.now() - started}ms`,
        ].join(" "));
        expect(leaked).toEqual([]);
      }, 600_000);
    }
  });
});
