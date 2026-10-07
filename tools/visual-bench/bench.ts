// JUYO visual-search benchmark.
//
//   node bench.ts <dataset-dir> <models-dir> [model-id ...]
//
// <dataset-dir> holds list.json ([{ id, category }]) and img/<i>.jpg — real
// published listing photos (one per listing). For every photo the tool
// builds deterministic views (crop, rotation, light, blur, compression,
// occlusion, new background, distance, synthetic viewpoint) and measures:
//   - retrieval: query = a view, gallery = all 99 originals + every view of
//     the OTHER listings (distractors); Recall@1/5/10 and MRR (= mAP with a
//     single relevant item);
//   - verification at a fixed false-positive budget: the threshold is the
//     99th / 95th percentile of cosine between DIFFERENT listings of the SAME
//     category (hard negatives), so models are compared at equal FPR, not at
//     one cosine number that means different things per model;
//   - same-category confusion of wrong top-1 hits; CPU latency; memory.
// Everything runs locally (onnxruntime-web WASM in Node); no network.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import * as ort from 'onnxruntime-web';
import { toTensor, l2normalize, cosine, pHash, hamming, type Pixels } from '../../lib/visual-preprocess.ts';
import { CANDIDATES, type Candidate } from './models.ts';

const [DATA, MODELS, ...only] = process.argv.slice(2);
if (!DATA || !MODELS) throw new Error('usage: node bench.ts <dataset-dir> <models-dir> [model-id ...]');
const OUT = path.join(import.meta.dirname, 'out');
await mkdir(OUT, { recursive: true });
ort.env.wasm.numThreads = Number(process.env.THREADS ?? Math.min(8, os.cpus().length));

const list: { id: string; category: string }[] = JSON.parse(await readFile(path.join(DATA, 'list.json'), 'utf8'));

// ---------- deterministic views ----------
const rnd = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const GREY = { r: 122, g: 122, b: 122 };

async function texture(w: number, h: number, seed: number) {
  const r = rnd(seed);
  const base = [60 + r() * 150, 60 + r() * 150, 60 + r() * 150];
  const buf = Buffer.alloc(w * h * 3);
  const fx = 0.02 + r() * 0.05, fy = 0.02 + r() * 0.05;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = 35 * Math.sin(x * fx) * Math.cos(y * fy) + (r() - 0.5) * 30;
    for (let c = 0; c < 3; c++) buf[(y * w + x) * 3 + c] = Math.max(0, Math.min(255, base[c] + v));
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

async function placeOn(b: Buffer, scale: number, bg: Buffer | 'plain', seed: number) {
  const m = await sharp(b).metadata();
  const W = m.width!, H = m.height!;
  const w = Math.round(W * scale), h = Math.round(H * scale);
  const small = await sharp(b).resize(w, h).toBuffer();
  const canvas = bg === 'plain'
    ? sharp({ create: { width: W, height: H, channels: 3, background: { r: 214, g: 210, b: 204 } } })
    : sharp(bg).resize(W, H);
  const r = rnd(seed);
  return canvas.composite([{ input: small, left: Math.round((W - w) * (0.2 + 0.6 * r())), top: Math.round((H - h) * (0.2 + 0.6 * r())) }]).jpeg({ quality: 90 }).toBuffer();
}

const jpg = (s: sharp.Sharp, q = 90) => s.jpeg({ quality: q }).toBuffer();

/** View name → transform of the original file bytes. `baseline_*` reproduce the 2026-10-04 run. */
const VIEWS: Record<string, (b: Buffer, i: number) => Promise<Buffer>> = {
  baseline_mild: async (b) => sharp(b).resize(500).jpeg({ quality: 45 }).toBuffer(),
  baseline_crop: async (b) => { const m = await sharp(b).metadata(); return jpg(sharp(b).extract({ left: Math.round(m.width! * 0.15), top: Math.round(m.height! * 0.1), width: Math.round(m.width! * 0.65), height: Math.round(m.height! * 0.7) })); },
  baseline_strong: async (b) => {
    const m = await sharp(b).metadata();
    return sharp(b)
      .extract({ left: Math.round(m.width! * 0.2), top: Math.round(m.height! * 0.05), width: Math.round(m.width! * 0.6), height: Math.round(m.height! * 0.75) })
      .rotate(17, { background: '#7a7a7a' })
      .affine([[1, 0.18], [0.05, 1]], { background: '#7a7a7a' })
      .flop()
      .modulate({ brightness: 1.25, saturation: 0.7, hue: 12 })
      .blur(1.1)
      .jpeg({ quality: 55 })
      .toBuffer();
  },
  B_viewpoint: async (b) => jpg(sharp(b).affine([[0.82, 0.22], [-0.06, 1.04]], { background: GREY }).rotate(-7, { background: GREY })),
  C_crop_tight: async (b) => { const m = await sharp(b).metadata(); return jpg(sharp(b).extract({ left: Math.round(m.width! * 0.22), top: Math.round(m.height! * 0.18), width: Math.round(m.width! * 0.5), height: Math.round(m.height! * 0.55) })); },
  D_rot20: async (b) => jpg(sharp(b).rotate(20, { background: GREY })),
  D_rot90: async (b) => jpg(sharp(b).rotate(90)),
  E_dark: async (b) => jpg(sharp(b).modulate({ brightness: 0.5 }).tint({ r: 255, g: 225, b: 190 })),
  E_bright: async (b) => jpg(sharp(b).modulate({ brightness: 1.55, saturation: 0.75 })),
  F_blur: async (b) => jpg(sharp(b).blur(3)),
  G_jpeg: async (b) => sharp(b).resize(320).jpeg({ quality: 18 }).toBuffer(),
  H_occlusion: async (b) => {
    const m = await sharp(b).metadata();
    const w = Math.round(m.width! * 0.38), h = Math.round(m.height! * 0.45);
    const patch = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 196, g: 150, b: 120 } } }).png().toBuffer();
    return jpg(sharp(b).composite([{ input: patch, left: m.width! - w - Math.round(m.width! * 0.04), top: Math.round(m.height! * 0.3) }]));
  },
  I_background: async (b, i) => { const m = await sharp(b).metadata(); return placeOn(b, 0.66, await texture(m.width!, m.height!, 1000 + i), i); },
  J_distance: async (b, i) => placeOn(b, 0.38, 'plain', 7 + i),
};
const EDIT_VIEWS = Object.keys(VIEWS).filter((v) => !v.startsWith('baseline_'));

async function decode(bytes: Buffer): Promise<Pixels> {
  const { data, info } = await sharp(bytes).rotate().removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: 3 };
}

// ---------- dataset (cached as raw pixels) ----------
console.error(`building views for ${list.length} photos…`);
const originals: Pixels[] = [];
const views: Record<string, Pixels[]> = Object.fromEntries(Object.keys(VIEWS).map((k) => [k, []]));
const originalBytes: Buffer[] = [];
for (let i = 0; i < list.length; i++) {
  const b = await readFile(path.join(DATA, 'img', `${i}.jpg`));
  originalBytes.push(b);
  originals.push(await decode(b));
  for (const [k, f] of Object.entries(VIEWS)) views[k].push(await decode(await f(b, i)));
}

// ---------- pHash (model independent) ----------
const ph = { orig: originals.map(pHash), views: Object.fromEntries(Object.entries(views).map(([k, v]) => [k, v.map(pHash)])) as Record<string, string[]> };
await writeFile(path.join(OUT, 'phash.json'), JSON.stringify(ph));

// ---------- embedding ----------
async function session(c: Candidate) {
  const opts: ort.InferenceSession.SessionOptions = { graphOptimizationLevel: 'all' };
  if (c.externalData) opts.externalData = [{ path: c.externalData, data: await readFile(path.join(MODELS, c.externalData)) }];
  return ort.InferenceSession.create(await readFile(path.join(MODELS, c.file)), opts);
}

function pool(c: Candidate, out: ort.InferenceSession.OnnxValueMapType): Float32Array {
  if (c.pooling === 'pooler') return out.pooler_output.data as Float32Array;
  if (c.pooling === 'image_embeds') return out.image_embeds.data as Float32Array;
  const t = out.last_hidden_state;
  const [, n, d] = t.dims as number[];
  const x = t.data as Float32Array;
  const cls = x.slice(0, d);
  if (c.pooling === 'cls') return cls;
  const mean = new Float32Array(d);
  for (let i = 1; i < n; i++) for (let j = 0; j < d; j++) mean[j] += x[i * d + j] / (n - 1);
  const a = l2normalize(cls), b = l2normalize(mean);
  return Float32Array.from([...a, ...b]);
}

async function embedAll(c: Candidate) {
  const cache = path.join(OUT, `emb-${c.id}.json`);
  if (existsSync(cache)) return JSON.parse(await readFile(cache, 'utf8')) as { orig: number[][]; views: Record<string, number[][]>; perf: Perf };
  const rssBefore = process.memoryUsage().rss;
  const s = await session(c);
  const rssLoaded = process.memoryUsage().rss;
  const n = c.spec.size;
  const run = async (px: Pixels) => {
    const t = new ort.Tensor('float32', toTensor(px, c.spec), [1, 3, n, n]);
    return l2normalize(pool(c, await s.run({ pixel_values: t })));
  };
  // latency on a fixed photo: preprocessing and inference separately
  const px = originals[0];
  for (let k = 0; k < 2; k++) await run(px);
  const pre: number[] = [], inf: number[] = [];
  for (let k = 0; k < 10; k++) {
    const t0 = performance.now();
    const x = toTensor(px, c.spec);
    const t1 = performance.now();
    await s.run({ pixel_values: new ort.Tensor('float32', x, [1, 3, n, n]) });
    pre.push(t1 - t0); inf.push(performance.now() - t1);
  }
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
  const orig: number[][] = [];
  for (const p of originals) orig.push(await run(p));
  const out: Record<string, number[][]> = {};
  for (const k of Object.keys(views)) { out[k] = []; for (const p of views[k]) out[k].push(await run(p)); }
  const perf: Perf = {
    preprocessMs: med(pre), inferenceMs: med(inf), threads: ort.env.wasm.numThreads as number,
    loadRssMB: (rssLoaded - rssBefore) / 1e6, peakRssMB: process.memoryUsage().rss / 1e6,
    dim: orig[0].length,
  };
  await s.release();
  const res = { orig, views: out, perf };
  await writeFile(cache, JSON.stringify(res));
  return res;
}
type Perf = { preprocessMs: number; inferenceMs: number; threads: number; loadRssMB: number; peakRssMB: number; dim: number };

// ---------- metrics ----------
const quant = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };

function sameCatNegatives(orig: number[][]) {
  const same: number[] = [];
  for (let i = 0; i < orig.length; i++) for (let j = i + 1; j < orig.length; j++) if (list[i].category === list[j].category) same.push(cosine(orig[i], orig[j]));
  return same;
}

function evaluate(e: { orig: number[][]; views: Record<string, number[][]> }) {
  const neg = sameCatNegatives(e.orig);
  const t1 = quant(neg, 0.99), t5 = quant(neg, 0.95);
  // gallery = originals + views of other listings
  const gallery: { vec: number[]; obj: number; orig: boolean }[] = e.orig.map((vec, obj) => ({ vec, obj, orig: true }));
  for (const k of EDIT_VIEWS) e.views[k].forEach((vec, obj) => gallery.push({ vec, obj, orig: false }));
  const perView: Record<string, { r1: number; r5: number; r10: number; mrr: number; tpr1: number; tpr5: number; cos80: number; sameCatWrongTop1: number }> = {};
  for (const k of Object.keys(e.views)) {
    let r1 = 0, r5 = 0, r10 = 0, mrr = 0, tp1 = 0, tp5 = 0, c80 = 0, wrong = 0, wrongSame = 0;
    e.views[k].forEach((q, i) => {
      const pos = cosine(q, e.orig[i]);
      let rank = 1, best = -2, bestObj = -1;
      for (const g of gallery) {
        if (g.obj === i) continue;
        const c = cosine(q, g.vec);
        if (c > pos) rank++;
        if (c > best) { best = c; bestObj = g.obj; }
      }
      if (rank === 1) r1++; else { wrong++; if (list[bestObj].category === list[i].category) wrongSame++; }
      if (rank <= 5) r5++;
      if (rank <= 10) r10++;
      mrr += 1 / rank;
      if (pos >= t1) tp1++;
      if (pos >= t5) tp5++;
      if (pos >= 0.8) c80++;
    });
    const n = e.views[k].length;
    perView[k] = { r1: r1 / n, r5: r5 / n, r10: r10 / n, mrr: mrr / n, tpr1: tp1 / n, tpr5: tp5 / n, cos80: c80 / n, sameCatWrongTop1: wrong ? wrongSame / wrong : 0 };
  }
  const avg = (f: (v: (typeof perView)[string]) => number) => EDIT_VIEWS.reduce((s, k) => s + f(perView[k]), 0) / EDIT_VIEWS.length;
  return {
    thresholdFpr1: t1, thresholdFpr5: t5,
    fprAt080: neg.filter((x) => x >= 0.8).length / neg.length,
    negatives: neg.length,
    perView,
    mean: { r1: avg((v) => v.r1), r5: avg((v) => v.r5), r10: avg((v) => v.r10), mrr: avg((v) => v.mrr), tpr1: avg((v) => v.tpr1), tpr5: avg((v) => v.tpr5), sameCatWrongTop1: avg((v) => v.sameCatWrongTop1) },
  };
}

// ---------- legacy baseline: current production preprocessing (sharp bicubic squash) ----------
async function legacyBaseline() {
  const c = CANDIDATES[0];
  const cache = path.join(OUT, 'emb-legacy-siglip.json');
  let e: { orig: number[][]; views: Record<string, number[][]> };
  if (existsSync(cache)) e = JSON.parse(await readFile(cache, 'utf8'));
  else {
    const s = await session(c);
    const run = async (px: Pixels) => {
      const raw = await sharp(px.data, { raw: { width: px.width, height: px.height, channels: 3 } }).resize(224, 224, { fit: 'fill', kernel: 'cubic' }).raw().toBuffer();
      const x = new Float32Array(3 * 224 * 224);
      for (let i = 0; i < 224 * 224; i++) for (let ch = 0; ch < 3; ch++) x[ch * 224 * 224 + i] = raw[i * 3 + ch] / 127.5 - 1;
      return l2normalize((await s.run({ pixel_values: new ort.Tensor('float32', x, [1, 3, 224, 224]) })).pooler_output.data as Float32Array);
    };
    // the 2026-10-04 run decoded at up to 2000 px work size, as sanitize() does
    const orig: number[][] = [];
    for (const p of originals) orig.push(await run(p));
    const vs: Record<string, number[][]> = {};
    for (const k of ['baseline_mild', 'baseline_crop', 'baseline_strong']) { vs[k] = []; for (const p of views[k]) vs[k].push(await run(p)); }
    e = { orig, views: vs };
    await writeFile(cache, JSON.stringify(e));
  }
  const neg = sameCatNegatives(e.orig);
  const pct = (xs: number[]) => (100 * xs.filter((x) => x >= 0.8).length / xs.length).toFixed(1);
  const pos = (k: string) => e.views[k].map((v, i) => cosine(v, e.orig[i]));
  return { crop: pct(pos('baseline_crop')), strong: pct(pos('baseline_strong')), mild: pct(pos('baseline_mild')), sameCatFpr: pct(neg), negatives: neg.length };
}

// ---------- run ----------
const results: Record<string, unknown> = {};
const legacy = await legacyBaseline();
const phSame: number[] = [];
for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i].category === list[j].category) phSame.push(hamming(ph.orig[i], ph.orig[j]));
const phashReport = {
  mildCopiesFound: ph.views.baseline_mild.filter((h, i) => hamming(h, ph.orig[i]) <= 8).length,
  falseDupSameCat: phSame.filter((h) => h <= 8).length,
  sameCatPairs: phSame.length,
  perView: Object.fromEntries(Object.keys(VIEWS).map((k) => [k, ph.views[k].filter((h, i) => hamming(h, ph.orig[i]) <= 8).length / list.length])),
  minSameCatDistance: Math.min(...phSame),
};
console.log('\nBASELINE (production preprocessing, cos ≥ 0.80):', legacy);
console.log('pHash (shared implementation):', phashReport);

for (const c of CANDIDATES) {
  if (only.length && !only.includes(c.id)) continue;
  console.error(`embedding with ${c.id}…`);
  const t0 = Date.now();
  const e = await embedAll(c);
  const ev = evaluate(e);
  results[c.id] = { label: c.label, license: c.license, commercialOk: c.commercialOk, perf: e.perf, ...ev };
  console.error(`  done in ${Math.round((Date.now() - t0) / 1000)} s`);
}

// Merge with earlier runs so models can be benchmarked in separate processes.
const prev = existsSync(path.join(OUT, 'results.json')) ? JSON.parse(await readFile(path.join(OUT, 'results.json'), 'utf8')) : { models: {} };
Object.assign(results, { ...prev.models, ...results });
await writeFile(path.join(OUT, 'results.json'), JSON.stringify({ date: new Date().toISOString(), photos: list.length, legacy, phash: phashReport, models: results }, null, 1));

const pct = (x: number) => (100 * x).toFixed(1).padStart(5);
console.log('\nmodel                        dim  R@1   R@5   R@10  MRR   TPR@1%FPR TPR@5%FPR  sameCat-wrong  pre ms  inf ms');
for (const [id, r] of Object.entries(results) as [string, any][]) {
  console.log(id.padEnd(28), String(r.perf.dim).padStart(4), pct(r.mean.r1), pct(r.mean.r5), pct(r.mean.r10), pct(r.mean.mrr), '  ', pct(r.mean.tpr1), '   ', pct(r.mean.tpr5), '      ', pct(r.mean.sameCatWrongTop1), '    ', r.perf.preprocessMs.toFixed(0).padStart(4), r.perf.inferenceMs.toFixed(0).padStart(6));
}
console.log('\nper view TPR@1%FPR (same-category hard negatives):');
console.log('view'.padEnd(17), Object.keys(results).map((k) => k.slice(0, 12).padStart(13)).join(''));
for (const v of Object.keys(VIEWS)) console.log(v.padEnd(17), Object.values(results).map((r: any) => pct(r.perView[v].tpr1).padStart(13)).join(''));
console.log('\nper view R@1:');
for (const v of Object.keys(VIEWS)) console.log(v.padEnd(17), Object.values(results).map((r: any) => pct(r.perView[v].r1).padStart(13)).join(''));
