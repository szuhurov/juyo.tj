// Fits the search_visual() ranking for a model on the REAL multi-view benchmark
// (instance-bench.ts), so thresholds and weights are measured, not guessed.
//
//   node fit-instance.ts <objectron-dir> <listings-dir> <model-id> [flip|global]
//
// Pairs (query view vs gallery photo):
//   positive — another photo of the same object (f1/f2 vs f0);
//   negative — a different object of the SAME category (the hard case), and
//              JUYO listing photos (real distractors).
// visual = sigmoid(a·cos + b·phashSim + c), phashSim = max(0, 1 − ham/32),
// class-balanced logistic regression. Thresholds: cosine at 1 % / 5 % FPR on
// same-category negatives. Writes out/instance/ranking-<id>.json.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { cosine, hamming, pHash } from '../../lib/visual-preprocess.ts';

const [DATA, LISTINGS, id, method = 'flip'] = process.argv.slice(2);
const OUT = path.join(import.meta.dirname, 'out', 'instance');
type Obj = { id: string; category: string; views: string[] };
const objs: Obj[] = JSON.parse(await readFile(path.join(DATA, 'list.json'), 'utf8'));
const listings: { category: string }[] = JSON.parse(await readFile(path.join(LISTINGS, 'list.json'), 'utf8'));
const emb: { global: number[]; flip: number[] }[] = JSON.parse(await readFile(path.join(OUT, `emb-${id}.json`), 'utf8'));
const vec = (i: number) => (method === 'flip' ? emb[i].flip : emb[i].global);

async function ph(file: string) {
  const { data, info } = await sharp(file).rotate().removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return pHash({ data, width: info.width, height: info.height, channels: 3 });
}
// same file order as instance-bench.ts
const meta: { obj: number; view: number; category: string; file: string }[] = [];
objs.forEach((o, i) => o.views.forEach((v, k) => meta.push({ obj: i, view: k, category: o.category, file: path.join(DATA, 'img', v) })));
listings.forEach((l, i) => { if (l.category === 'Documents' || l.category === 'Cards') return; meta.push({ obj: -1 - i, view: 0, category: 'listing', file: path.join(LISTINGS, 'img', `${i}.jpg`) }); });
if (meta.length !== emb.length) throw new Error(`embedding count ${emb.length} ≠ photos ${meta.length}`);
const hashes = await Promise.all(meta.map((m) => ph(m.file)));

type Pair = { cos: number; ps: number; y: 0 | 1 };
const pairs: Pair[] = [];
const sameCatNeg: number[] = [];
const ps = (i: number, j: number) => Math.max(0, 1 - hamming(hashes[i], hashes[j]) / 32);
meta.forEach((q, i) => {
  if (q.view === 0 || q.obj < 0) return;
  meta.forEach((g, j) => {
    if (g.view !== 0) return;
    const c = cosine(vec(i), vec(j));
    if (g.obj === q.obj) pairs.push({ cos: c, ps: ps(i, j), y: 1 });
    else if (g.category === q.category || g.obj < 0) {
      pairs.push({ cos: c, ps: ps(i, j), y: 0 });
      if (g.category === q.category) sameCatNeg.push(c);
    }
  });
});
const pos = pairs.filter((p) => p.y === 1), neg = pairs.filter((p) => p.y === 0);
const quant = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const t1 = quant(sameCatNeg, 0.99), t5 = quant(sameCatNeg, 0.95);

let a = 0, b = 0, c = 0;
const wPos = 0.5 / pos.length, wNeg = 0.5 / neg.length, lambda = 1e-3, lr = 5;
const sig = (z: number) => 1 / (1 + Math.exp(-z));
for (let it = 0; it < 20000; it++) {
  let ga = lambda * a, gb = lambda * b, gc = 0;
  for (const p of pairs) {
    const w = p.y ? wPos : wNeg;
    const e = (sig(a * p.cos + b * p.ps + c) - p.y) * w;
    ga += e * p.cos; gb += e * p.ps; gc += e;
  }
  a -= lr * ga; b -= lr * gb; c -= lr * gc;
}
const tpr = (t: number) => pos.filter((p) => p.cos >= t).length / pos.length;
const res = {
  model: id, method, positives: pos.length, negatives: neg.length, sameCategoryNegatives: sameCatNeg.length,
  t_similar: +t5.toFixed(4), t_very_similar: +t1.toFixed(4), tprAtSimilar: +tpr(t5).toFixed(3), tprAtVerySimilar: +tpr(t1).toFixed(3),
  w_cos: +a.toFixed(3), w_phash: +b.toFixed(3), w_bias: +c.toFixed(3),
};
console.log(res);
await writeFile(path.join(OUT, `ranking-${id}-${method}.json`), JSON.stringify(res, null, 1));
