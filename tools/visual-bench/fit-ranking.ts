// Fits the visual part of the search_visual() ranking on benchmark data and
// derives the relevance thresholds, so neither is a guessed number.
//
//   node fit-ranking.ts <dataset-dir> <model-id>
//
// Needs out/emb-<model-id>.json and out/phash.json from bench.ts.
// Pairs:
//   positive — an edited view of a listing photo vs. that photo (11 edit kinds)
//   negative — a DIFFERENT listing of the SAME category (original vs original,
//              and edited view vs original), i.e. the hard negatives a lost &
//              found search actually faces.
// Model: visual = sigmoid(a·cos + b·phashSim + c), phashSim = max(0, 1 − ham/32),
// logistic regression, class-balanced, small L2. Thresholds: cosine at a 1 %
// and 5 % false-positive rate on the negatives.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cosine, hamming } from '../../lib/visual-preprocess.ts';

const [DATA, id] = process.argv.slice(2);
const OUT = path.join(import.meta.dirname, 'out');
const list: { category: string }[] = JSON.parse(await readFile(path.join(DATA, 'list.json'), 'utf8'));
const emb = JSON.parse(await readFile(path.join(OUT, `emb-${id}.json`), 'utf8')) as { orig: number[][]; views: Record<string, number[][]> };
const ph = JSON.parse(await readFile(path.join(OUT, 'phash.json'), 'utf8')) as { orig: string[]; views: Record<string, string[]> };
const EDIT = Object.keys(emb.views).filter((k) => !k.startsWith('baseline_'));

type Pair = { cos: number; ps: number; y: 0 | 1; kind: string };
const pairs: Pair[] = [];
const ps = (h: number) => Math.max(0, 1 - h / 32);
for (const k of EDIT) emb.views[k].forEach((v, i) => pairs.push({ cos: cosine(v, emb.orig[i]), ps: ps(hamming(ph.views[k][i], ph.orig[i])), y: 1, kind: k }));
for (let i = 0; i < list.length; i++) for (let j = 0; j < list.length; j++) {
  if (i === j || list[i].category !== list[j].category) continue;
  if (i < j) pairs.push({ cos: cosine(emb.orig[i], emb.orig[j]), ps: ps(hamming(ph.orig[i], ph.orig[j])), y: 0, kind: 'orig' });
  for (const k of EDIT) pairs.push({ cos: cosine(emb.views[k][i], emb.orig[j]), ps: ps(hamming(ph.views[k][i], ph.orig[j])), y: 0, kind: k });
}
const pos = pairs.filter((p) => p.y === 1), neg = pairs.filter((p) => p.y === 0);

// logistic regression, gradient descent, class-balanced
let a = 0, b = 0, c = 0;
const wPos = 0.5 / pos.length, wNeg = 0.5 / neg.length, lambda = 1e-3, lr = 5;
const sig = (z: number) => 1 / (1 + Math.exp(-z));
for (let it = 0; it < 20000; it++) {
  let ga = 0, gb = 0, gc = 0;
  for (const p of pairs) {
    const e = (sig(a * p.cos + b * p.ps + c) - p.y) * (p.y ? wPos : wNeg);
    ga += e * p.cos; gb += e * p.ps; gc += e;
  }
  a -= lr * (ga + lambda * a); b -= lr * (gb + lambda * b); c -= lr * gc;
}

const quant = (xs: number[], q: number) => { const s = [...xs].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]; };
const auc = (score: (p: Pair) => number) => {
  const all = pairs.map((p) => ({ s: score(p), y: p.y })).sort((x, y) => x.s - y.s);
  let rank = 0, sumPos = 0;
  for (const r of all) { rank++; if (r.y) sumPos += rank; }
  return (sumPos - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
};
const tprAt = (score: (p: Pair) => number, fpr: number) => { const t = quant(neg.map(score), 1 - fpr); return pos.filter((p) => score(p) > t).length / pos.length; };
const cosOnly = (p: Pair) => p.cos;
const fused = (p: Pair) => sig(a * p.cos + b * p.ps + c);

const report = {
  model: id,
  pairs: { positives: pos.length, hardNegatives: neg.length },
  weights: { a: +a.toFixed(3), b: +b.toFixed(3), c: +c.toFixed(3) },
  auc: { cosine: +auc(cosOnly).toFixed(4), fused: +auc(fused).toFixed(4) },
  tprAtFpr1: { cosine: +tprAt(cosOnly, 0.01).toFixed(4), fused: +tprAt(fused, 0.01).toFixed(4) },
  tprAtFpr5: { cosine: +tprAt(cosOnly, 0.05).toFixed(4), fused: +tprAt(fused, 0.05).toFixed(4) },
  thresholds: { t_very_similar: +quant(neg.map(cosOnly), 0.99).toFixed(4), t_similar: +quant(neg.map(cosOnly), 0.95).toFixed(4) },
  pHashDuplicate: {
    falseDuplicatesAt8: neg.filter((p) => p.ps >= 0.75).length,
    hardNegatives: neg.length,
  },
};
await writeFile(path.join(OUT, `ranking-${id}.json`), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
