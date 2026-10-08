// Real multi-view instance benchmark ("same object, another photo").
//
//   node instance-bench.ts <objectron-dir> <models-dir> [<listings-dir>] [model-id ...]
//
// <objectron-dir>/list.json: [{ id, category, views: [f0, f1, f2] }] built by
// juyo-bench/objectron/tools/fetch.mjs from Google Objectron (C-UDA-1.0,
// computational use only; frames never leave the developer computer).
// Each object was filmed by a person walking around it: f0/f1/f2 are frames
// from three camera positions. Protocol, as in lost & found:
//   gallery = f0 of every object (the owner's photo) + optional JUYO listing
//             photos as distractors;
//   queries = f1, f2 (the finder's photo, another angle/distance).
// Hard negatives = other objects of the SAME category (25 shoes, 25 cups, …).
// Metrics: R@1, R@5, mAP (= MRR, one relevant), TPR at 1 % FPR on
// same-category negatives. Methods compared per model:
//   global   — whole photo (the current production method);
//   flip     — mean of photo + mirror;
//   fg       — object crop found from the model's own patch tokens (PCA),
//              vector = normalize(global + crop);
//   fg+flip  — both.
// Everything runs locally with onnxruntime-web (WASM), same runtime as the browser.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import * as ort from 'onnxruntime-web';
import { toTensor, l2normalize, cosine, type Pixels, type PreprocessSpec } from '../../lib/visual-preprocess.ts';

const [DATA, MODELS, maybeListings, ...rest] = process.argv.slice(2);
const LISTINGS = maybeListings && existsSync(path.join(maybeListings, 'list.json')) ? maybeListings : null;
const only = LISTINGS ? rest : [maybeListings, ...rest].filter(Boolean);
const OUT = path.join(import.meta.dirname, 'out', 'instance');
await mkdir(OUT, { recursive: true });
ort.env.wasm.numThreads = Number(process.env.THREADS ?? Math.min(8, os.cpus().length));

const IMAGENET = { mean: [0.485, 0.456, 0.406] as [number, number, number], std: [0.229, 0.224, 0.225] as [number, number, number] };
const HALF = { mean: [0.5, 0.5, 0.5] as [number, number, number], std: [0.5, 0.5, 0.5] as [number, number, number] };

interface M { id: string; file: string; spec: PreprocessSpec; pool: 'cls' | 'pooler'; patchStart: number; mb: number }
const MODELS_LIST: M[] = [
  { id: 'dinov2-s14-q4-r280', file: 'dinov2s_q4.onnx', spec: { size: 280, mode: 'squash', ...IMAGENET }, pool: 'cls', patchStart: 1, mb: 16.9 },
  { id: 'dinov2-s14-fp32-r280', file: 'dinov2s_fp32.onnx', spec: { size: 280, mode: 'squash', ...IMAGENET }, pool: 'cls', patchStart: 1, mb: 88.5 },
  { id: 'dinov2-s14-q4-r392', file: 'dinov2s_q4.onnx', spec: { size: 392, mode: 'squash', ...IMAGENET }, pool: 'cls', patchStart: 1, mb: 16.9 },
  { id: 'dinov2-b14-q8', file: 'dinov2b_q.onnx', spec: { size: 224, mode: 'squash', ...IMAGENET }, pool: 'cls', patchStart: 1, mb: 91 },
  { id: 'siglip-b16-224-q8', file: 'siglip_q.onnx', spec: { size: 224, mode: 'squash', ...HALF }, pool: 'pooler', patchStart: 0, mb: 99.5 },
  { id: 'siglip2-b16-256-q4', file: 'siglip2b256_q4.onnx', spec: { size: 256, mode: 'squash', ...HALF }, pool: 'pooler', patchStart: 0, mb: 63.5 },
  { id: 'siglip2-b16-384-q4', file: 'siglip2b384_q4.onnx', spec: { size: 384, mode: 'squash', ...HALF }, pool: 'pooler', patchStart: 0, mb: 64.4 },
  { id: 'siglip2-b16-512-q4', file: 'siglip2b512_q4.onnx', spec: { size: 512, mode: 'squash', ...HALF }, pool: 'pooler', patchStart: 0, mb: 65.8 },
];

type Obj = { id: string; category: string; views: string[] };
const objs: Obj[] = JSON.parse(await readFile(path.join(DATA, 'list.json'), 'utf8'));
const listings: { category: string }[] = LISTINGS
  ? (JSON.parse(await readFile(path.join(LISTINGS, 'list.json'), 'utf8')) as { category: string }[])
  : [];

async function decode(file: string): Promise<Pixels> {
  const { data, info } = await sharp(file).rotate().removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: 3 };
}
function flipPx(px: Pixels): Pixels {
  const { width: w, height: h } = px;
  const out = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) out[(y * w + x) * 3 + c] = px.data[(y * w + (w - 1 - x)) * 3 + c];
  return { data: out, width: w, height: h, channels: 3 };
}
function cropPx(px: Pixels, x0: number, y0: number, cw: number, ch: number): Pixels {
  const out = new Uint8Array(cw * ch * 3);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) for (let c = 0; c < 3; c++) out[(y * cw + x) * 3 + c] = px.data[((y0 + y) * px.width + x0 + x) * 3 + c];
  return { data: out, width: cw, height: ch, channels: 3 };
}

/** Foreground box from patch tokens: first principal component, sign fixed so the border is background. */
function foregroundBox(tokens: Float32Array, n: number, d: number, start: number): [number, number, number, number] | null {
  const g = Math.round(Math.sqrt(n - start));
  if (g * g !== n - start) return null;
  const P = g * g;
  const mean = new Float64Array(d);
  for (let i = 0; i < P; i++) for (let j = 0; j < d; j++) mean[j] += tokens[(start + i) * d + j] / P;
  let v = new Float64Array(d).map((_, j) => Math.sin(j + 1));
  const proj = new Float64Array(P);
  for (let it = 0; it < 30; it++) {
    for (let i = 0; i < P; i++) { let s = 0; for (let j = 0; j < d; j++) s += (tokens[(start + i) * d + j] - mean[j]) * v[j]; proj[i] = s; }
    const nv = new Float64Array(d);
    for (let i = 0; i < P; i++) for (let j = 0; j < d; j++) nv[j] += proj[i] * (tokens[(start + i) * d + j] - mean[j]);
    const norm = Math.hypot(...nv) || 1;
    v = nv.map((x) => x / norm);
  }
  for (let i = 0; i < P; i++) { let s = 0; for (let j = 0; j < d; j++) s += (tokens[(start + i) * d + j] - mean[j]) * v[j]; proj[i] = s; }
  let border = 0, nb = 0;
  for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) if (x === 0 || y === 0 || x === g - 1 || y === g - 1) { border += proj[y * g + x]; nb++; }
  const sign = border / nb > 0 ? -1 : 1;
  let x0 = g, y0 = g, x1 = -1, y1 = -1, cnt = 0;
  for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) if (sign * proj[y * g + x] > 0) { cnt++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (cnt < P * 0.03 || x1 < 0) return null;
  const area = ((x1 - x0 + 1) * (y1 - y0 + 1)) / P;
  if (area > 0.85) return null;
  return [x0 / g, y0 / g, (x1 + 1) / g, (y1 + 1) / g];
}

type Emb = { global: number[]; flip: number[]; fg: number[] | null; box: number[] | null };

async function embedModel(m: M, files: string[]): Promise<Emb[]> {
  const cache = path.join(OUT, `emb-${m.id}.json`);
  if (existsSync(cache)) return JSON.parse(await readFile(cache, 'utf8'));
  const s = await ort.InferenceSession.create(await readFile(path.join(MODELS, m.file)), { graphOptimizationLevel: 'all' });
  const n = m.spec.size;
  const run = async (px: Pixels) => {
    const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', toTensor(px, m.spec), [1, 3, n, n]) });
    const lh = out.last_hidden_state;
    const [, T, d] = lh.dims as number[];
    const tokens = lh.data as Float32Array;
    const vec = m.pool === 'cls' ? tokens.slice(0, d) : (out.pooler_output.data as Float32Array);
    return { vec: l2normalize(vec), tokens, T, d };
  };
  const res: Emb[] = [];
  const t0 = performance.now();
  for (const f of files) {
    const px = await decode(f);
    const a = await run(px);
    const b = await run(flipPx(px));
    const box = process.env.SKIP_FG ? null : foregroundBox(a.tokens, a.T, a.d, m.patchStart);
    let fg: number[] | null = null;
    if (box) {
      // 12 % margin around the object, clamped
      const W = px.width, H = px.height;
      const mx = (box[2] - box[0]) * 0.12, my = (box[3] - box[1]) * 0.12;
      const X0 = Math.max(0, Math.floor((box[0] - mx) * W)), Y0 = Math.max(0, Math.floor((box[1] - my) * H));
      const X1 = Math.min(W, Math.ceil((box[2] + mx) * W)), Y1 = Math.min(H, Math.ceil((box[3] + my) * H));
      if (X1 - X0 > 32 && Y1 - Y0 > 32) fg = (await run(cropPx(px, X0, Y0, X1 - X0, Y1 - Y0))).vec;
    }
    res.push({ global: a.vec, flip: l2normalize(a.vec.map((x, i) => x + b.vec[i])), fg, box });
    if (res.length % 100 === 0) console.error(`  ${m.id}: ${res.length}/${files.length} (${((performance.now() - t0) / res.length).toFixed(0)} ms/photo)`);
  }
  await s.release();
  await writeFile(cache, JSON.stringify(res));
  return res;
}

const files: string[] = [];
const meta: { obj: number; view: number; category: string }[] = [];
objs.forEach((o, i) => o.views.forEach((v, k) => { files.push(path.join(DATA, 'img', v)); meta.push({ obj: i, view: k, category: o.category }); }));
const nObj = files.length;
// Documents/Cards photos are never published any more — never used, not even as distractors.
listings.forEach((l, i) => { if (l.category === 'Documents' || l.category === 'Cards') return; files.push(path.join(LISTINGS!, 'img', `${i}.jpg`)); meta.push({ obj: -1 - i, view: 0, category: 'listing:' + l.category }); });

const quant = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };

function evaluate(vecs: number[][]) {
  const gallery = meta.map((m, i) => ({ ...m, i })).filter((m) => m.view === 0);
  const queries = meta.map((m, i) => ({ ...m, i })).filter((m) => m.view > 0 && m.obj >= 0);
  // hard negatives: query vs gallery photo of a different object of the same category
  const neg: number[] = [];
  for (const q of queries) for (const g of gallery) if (g.obj !== q.obj && g.category === q.category) neg.push(cosine(vecs[q.i], vecs[g.i]));
  const t1 = quant(neg, 0.99);
  let r1 = 0, r5 = 0, mrr = 0, tpr = 0;
  for (const q of queries) {
    const pos = gallery.find((g) => g.obj === q.obj)!;
    const ps = cosine(vecs[q.i], vecs[pos.i]);
    let rank = 1;
    for (const g of gallery) if (g.obj !== q.obj && cosine(vecs[q.i], vecs[g.i]) > ps) rank++;
    if (rank === 1) r1++;
    if (rank <= 5) r5++;
    mrr += 1 / rank;
    if (ps >= t1) tpr++;
  }
  const N = queries.length;
  return { r1: (100 * r1) / N, r5: (100 * r5) / N, map: (100 * mrr) / N, tpr1: (100 * tpr) / N, t1, queries: N, gallery: gallery.length };
}

const results: Record<string, Record<string, ReturnType<typeof evaluate>> & { mb?: unknown; fgRate?: unknown }> = {};
for (const m of MODELS_LIST) {
  if (only.length && !only.includes(m.id)) continue;
  if (!existsSync(path.join(MODELS, m.file))) { console.error(`skip ${m.id}: no ${m.file}`); continue; }
  console.error(`embedding ${files.length} photos with ${m.id}…`);
  const e = await embedModel(m, files);
  const fgv = (x: Emb, base: number[]) => (x.fg ? l2normalize(base.map((v, i) => v + x.fg![i])) : base);
  results[m.id] = {
    global: evaluate(e.map((x) => x.global)),
    flip: evaluate(e.map((x) => x.flip)),
    fg: evaluate(e.map((x) => fgv(x, x.global))),
    'fg+flip': evaluate(e.map((x) => fgv(x, x.flip))),
    mb: m.mb,
    fgRate: Math.round((100 * e.filter((x) => x.fg).length) / e.length),
  } as never;
}

console.log(`\nobjects ${objs.length}, queries ${2 * nObj / 3}, listing distractors ${listings.length}`);
console.log('model'.padEnd(22), 'MB'.padStart(6), 'method'.padEnd(8), '  R@1    R@5    mAP  TPR@1%FPR  fg%');
for (const [id, r] of Object.entries(results)) for (const k of ['global', 'flip', 'fg', 'fg+flip']) {
  const x = (r as Record<string, ReturnType<typeof evaluate>>)[k];
  console.log(id.padEnd(22), String(r.mb).padStart(6), k.padEnd(8), x.r1.toFixed(1).padStart(6), x.r5.toFixed(1).padStart(6), x.map.toFixed(1).padStart(6), x.tpr1.toFixed(1).padStart(9), String(r.fgRate).padStart(5));
}
await writeFile(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
