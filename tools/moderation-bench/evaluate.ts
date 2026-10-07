// Trains and compares the weapon classifiers, picks thresholds, writes the head.
//
//   node evaluate.ts <open-images-dir> <emb-open.json> <emb-juyo.json> <models-dir>
//
// Candidates (all local, none sends anything anywhere):
//   C-lr   logistic regression on the DINOv2 vector the phone already makes
//   C-mlp  384→32→1 MLP on the same vector
//   A-zs   SigLIP zero-shot: image vector vs fixed text-prompt vectors
//   A-lr   logistic regression on the SigLIP image vector (reference only)
//
// Splits come from list.json (hash of the image id: 60/20/20). Hyper-parameters
// and thresholds are chosen on `val`; every number reported for a decision is
// on `test`, which nothing was fitted on. JUYO's own 99 published photos are an
// extra in-domain "safe" check (all of them are ordinary listings).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import * as ort from 'onnxruntime-web';
import { makeTokenizer, MAX_LEN } from './siglip-tokenizer.ts';

const [DATA, EMB_OPEN, EMB_JUYO, MODELS] = process.argv.slice(2);
if (!MODELS) throw new Error('usage: node evaluate.ts <open-images-dir> <emb-open.json> <emb-juyo.json> <models-dir>');
const OUT = path.join(import.meta.dirname, 'out');
await mkdir(OUT, { recursive: true });
ort.env.wasm.numThreads = Math.min(8, os.cpus().length);

type Entry = { id: string; label: 'firearm' | 'blade' | 'safe'; split: 'train' | 'val' | 'test'; tags: string[] };
const list: Entry[] = JSON.parse(await readFile(path.join(DATA, 'list.json'), 'utf8'));
const emb = JSON.parse(await readFile(EMB_OPEN, 'utf8')) as { ids: string[]; dino: number[][]; siglip: number[][]; perf: Record<string, any> };
const juyo = JSON.parse(await readFile(EMB_JUYO, 'utf8')) as { ids: string[]; dino: number[][]; siglip: number[][] };
const byId = new Map(list.map((e) => [e.id, e]));
const rows = emb.ids.map((id, i) => ({ e: byId.get(id)!, dino: emb.dino[i], siglip: emb.siglip[i] })).filter((r) => r.e);
const CATS = ['firearm', 'blade'] as const;
type Cat = typeof CATS[number];
const split = (s: string) => rows.filter((r) => r.e.split === s);
const train = split('train'), val = split('val'), test = split('test');

// ---------------- metrics ----------------
function auroc(pos: number[], neg: number[]) {
  // Mann–Whitney U with ties counted as 1/2
  const all = [...pos.map((s) => [s, 1] as const), ...neg.map((s) => [s, 0] as const)].sort((a, b) => a[0] - b[0]);
  let rank = 0, sumPos = 0;
  for (let i = 0; i < all.length;) {
    let j = i;
    while (j < all.length && all[j][0] === all[i][0]) j++;
    const avg = (i + j + 1) / 2;
    for (let k = i; k < j; k++) if (all[k][1]) sumPos += avg;
    rank += j - i; i = j;
  }
  return (sumPos - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
}
function at(pos: number[], neg: number[], t: number) {
  const tp = pos.filter((s) => s >= t).length, fn = pos.length - tp;
  const fp = neg.filter((s) => s >= t).length, tn = neg.length - fp;
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp / Math.max(1, pos.length);
  return { tp, fp, tn, fn, precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0, fpr: fp / Math.max(1, neg.length), fnr: fn / Math.max(1, pos.length) };
}
/** Lowest threshold that still keeps recall ≥ r (SAFE must not swallow weapons). */
function thresholdForRecall(pos: number[], r: number) {
  const s = [...pos].sort((a, b) => b - a);
  return s[Math.min(s.length - 1, Math.ceil(r * s.length) - 1)];
}
/** Lowest threshold with precision ≥ p AND no negative above it at all on val (BLOCK must be conservative). */
function thresholdForBlock(pos: number[], neg: number[], p: number) {
  const maxNeg = Math.max(...neg);
  const cands = [...new Set([...pos, ...neg])].sort((a, b) => a - b).filter((t) => t > maxNeg);
  for (const t of cands) if (at(pos, neg, t).precision >= p && at(pos, neg, t).tp > 0) return t;
  return Infinity;
}
/** Wilson 95 % lower bound — how good a precision of k/n can honestly be called. */
const wilsonLow = (k: number, n: number) => {
  if (!n) return 0;
  const z = 1.96, ph = k / n;
  return (ph + z * z / (2 * n) - z * Math.sqrt((ph * (1 - ph) + z * z / (4 * n)) / n)) / (1 + z * z / n);
};

// ---------------- models ----------------
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const dot = (a: number[], b: number[] | Float64Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

/** L2-regularised logistic regression, class-balanced, full-batch Adam (deterministic). */
function fitLR(X: number[][], y: number[], lambda: number, iters = 1500) {
  const d = X[0].length;
  const w = new Float64Array(d); let b = 0;
  const npos = y.filter((v) => v).length, nneg = y.length - npos;
  const cw = y.map((v) => (v ? y.length / (2 * npos) : y.length / (2 * nneg)));
  const m = new Float64Array(d + 1), v2 = new Float64Array(d + 1);
  const lr = 0.05, b1 = 0.9, b2 = 0.999;
  for (let t = 1; t <= iters; t++) {
    const g = new Float64Array(d + 1);
    for (let i = 0; i < X.length; i++) {
      const err = (sigmoid(dot(X[i], w) + b) - y[i]) * cw[i];
      for (let j = 0; j < d; j++) g[j] += err * X[i][j];
      g[d] += err;
    }
    for (let j = 0; j < d; j++) g[j] = g[j] / X.length + lambda * w[j];
    g[d] /= X.length;
    for (let j = 0; j <= d; j++) {
      m[j] = b1 * m[j] + (1 - b1) * g[j];
      v2[j] = b2 * v2[j] + (1 - b2) * g[j] * g[j];
      const step = (lr * (m[j] / (1 - b1 ** t))) / (Math.sqrt(v2[j] / (1 - b2 ** t)) + 1e-8);
      if (j < d) w[j] -= step; else b -= step;
    }
  }
  return { w: Array.from(w), b, score: (x: number[]) => sigmoid(dot(x, w) + b) };
}

/** 384→H→1 MLP, ReLU, class-balanced, Adam, fixed seed; early stop on val AUROC. */
function fitMLP(X: number[][], y: number[], Xv: number[][], yv: number[], H = 32, epochs = 200, lambda = 1e-4) {
  const d = X[0].length;
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 - 0.5; };
  const W1 = Array.from({ length: H }, () => Float64Array.from({ length: d }, () => rnd() * 2 * Math.sqrt(6 / (d + H))));
  const b1 = new Float64Array(H), W2 = Float64Array.from({ length: H }, () => rnd() * 2 * Math.sqrt(6 / (H + 1)));
  let b2 = 0;
  const npos = y.filter((v) => v).length, nneg = y.length - npos;
  const params = [...W1, b1, W2];
  const mom = params.map((p) => new Float64Array(p.length)), vel = params.map((p) => new Float64Array(p.length));
  let mb2 = 0, vb2 = 0, t = 0;
  const fwd = (x: number[]) => {
    const h = new Float64Array(H);
    for (let k = 0; k < H; k++) h[k] = Math.max(0, dot(x, W1[k]) + b1[k]);
    return { h, p: sigmoid(dot(Array.from(h), W2) + b2) };
  };
  let best = { auc: -1, snap: '' };
  const order = X.map((_, i) => i);
  for (let ep = 0; ep < epochs; ep++) {
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor((rnd() + 0.5) * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (let s = 0; s < order.length; s += 64) {
      const batch = order.slice(s, s + 64);
      const g = params.map((p) => new Float64Array(p.length)); let gb2 = 0;
      for (const i of batch) {
        const { h, p } = fwd(X[i]);
        const err = (p - y[i]) * (y[i] ? y.length / (2 * npos) : y.length / (2 * nneg)) / batch.length;
        for (let k = 0; k < H; k++) {
          g[H + 1][k] += err * h[k];
          if (h[k] <= 0) continue;
          const e2 = err * W2[k];
          g[H][k] += e2;
          for (let j = 0; j < d; j++) g[k][j] += e2 * X[i][j];
        }
        gb2 += err;
      }
      t++;
      params.forEach((p, pi) => {
        for (let j = 0; j < p.length; j++) {
          const gj = g[pi][j] + lambda * p[j];
          mom[pi][j] = 0.9 * mom[pi][j] + 0.1 * gj;
          vel[pi][j] = 0.999 * vel[pi][j] + 0.001 * gj * gj;
          p[j] -= (0.003 * mom[pi][j] / (1 - 0.9 ** t)) / (Math.sqrt(vel[pi][j] / (1 - 0.999 ** t)) + 1e-8);
        }
      });
      mb2 = 0.9 * mb2 + 0.1 * gb2; vb2 = 0.999 * vb2 + 0.001 * gb2 * gb2;
      b2 -= (0.003 * mb2 / (1 - 0.9 ** t)) / (Math.sqrt(vb2 / (1 - 0.999 ** t)) + 1e-8);
    }
    const sv = Xv.map((x) => fwd(x).p);
    const auc = auroc(sv.filter((_, i) => yv[i]), sv.filter((_, i) => !yv[i]));
    if (auc > best.auc) best = { auc, snap: JSON.stringify({ W1: W1.map((r) => Array.from(r)), b1: Array.from(b1), W2: Array.from(W2), b2 }) };
  }
  const s = JSON.parse(best.snap);
  return { score: (x: number[]) => { let z = s.b2; for (let k = 0; k < H; k++) z += s.W2[k] * Math.max(0, dot(x, s.W1[k]) + s.b1[k]); return sigmoid(z); } };
}

// ---------------- A: SigLIP zero-shot ----------------
const PROMPTS: Record<Cat | 'safe', string[]> = {
  firearm: ['a photo of a gun', 'a photo of a handgun', 'a photo of a pistol', 'a photo of a rifle', 'a photo of a shotgun', 'a photo of a firearm', 'a photo of a revolver'],
  blade: ['a photo of a knife', 'a photo of a kitchen knife', 'a photo of a dagger', 'a photo of a sword', 'a photo of a machete', 'a photo of a hunting knife'],
  safe: ['a photo of a phone', 'a photo of a wallet', 'a photo of keys', 'a photo of a bag', 'a photo of a tool', 'a photo of a toy', 'a photo of a dog',
    'a photo of a cat', 'a photo of a car', 'a photo of clothes', 'a photo of food', 'a photo of a document', 'a photo of a watch', 'a photo of glasses',
    'a photo of a building', 'a photo of a street', 'a photo of electronics', 'a photo of jewelry', 'a photo of a pen', 'a photo of scissors',
    'a photo of a screwdriver', 'a photo of a hammer', 'a photo of furniture', 'a photo of a room', 'a photo of an object'],
};
const tokenizer = makeTokenizer(JSON.parse(await readFile(path.join(MODELS, 'siglip_tokenizer.json'), 'utf8')));
const textBytes = await readFile(path.join(MODELS, 'siglip_text_q.onnx'));
const TEXT_SHA = 'ad0329b1f35acc66d8953ff2559ce358da8eb0a7011794cf951523d63a4dbce2';
if (createHash('sha256').update(textBytes).digest('hex') !== TEXT_SHA) throw new Error('siglip_text_q.onnx checksum mismatch');
const textSession = await ort.InferenceSession.create(textBytes);
const promptVec: Record<string, number[][]> = {};
for (const [k, ps] of Object.entries(PROMPTS)) {
  promptVec[k] = [];
  for (const p of ps) {
    const ids = BigInt64Array.from(tokenizer(p).map(BigInt));
    const out = await textSession.run({ input_ids: new ort.Tensor('int64', ids, [1, MAX_LEN]) });
    const v = Array.from(out.pooler_output.data as Float32Array);
    const n = Math.hypot(...v);
    promptVec[k].push(v.map((x) => x / n));
  }
}
function zeroShot(temp: number) {
  return (x: number[]) => {
    const logits = Object.entries(promptVec).flatMap(([k, vs]) => vs.map((v) => [k, temp * dot(x, v)] as const));
    const mx = Math.max(...logits.map((l) => l[1]));
    const z = logits.reduce((s, l) => s + Math.exp(l[1] - mx), 0);
    const by = (c: string) => logits.filter((l) => l[0] === c).reduce((s, l) => s + Math.exp(l[1] - mx), 0) / z;
    return { firearm: by('firearm'), blade: by('blade') } as Record<Cat, number>;
  };
}

// ---------------- fit everything ----------------
type Scorer = (r: { dino: number[]; siglip: number[] }) => Record<Cat, number>;
const yOf = (rs: typeof rows, c: Cat) => rs.map((r) => (r.e.label === c ? 1 : 0));
const candidates: Record<string, { scorer: Scorer; note: string; head?: Record<Cat, { w: number[]; b: number; lambda: number }> }> = {};

for (const feat of ['dino', 'siglip'] as const) {
  const head: Record<string, { w: number[]; b: number; lambda: number }> = {};
  const fns: Record<string, (x: number[]) => number> = {};
  for (const c of CATS) {
    let best = { auc: -1, lambda: 0, m: null as ReturnType<typeof fitLR> | null };
    for (const lambda of [1e-4, 1e-3, 1e-2]) {
      // the category's positives vs the safe class (the other weapon class is left out of the fit)
      const tr = train.filter((r) => r.e.label === c || r.e.label === 'safe');
      const m = fitLR(tr.map((r) => r[feat]), yOf(tr, c), lambda);
      const vs = val.filter((r) => r.e.label === c || r.e.label === 'safe');
      const s = vs.map((r) => m.score(r[feat]));
      const auc = auroc(s.filter((_, i) => vs[i].e.label === c), s.filter((_, i) => vs[i].e.label === 'safe'));
      if (auc > best.auc) best = { auc, lambda, m };
    }
    head[c] = { w: best.m!.w, b: best.m!.b, lambda: best.lambda };
    fns[c] = best.m!.score;
    console.error(`${feat} LR ${c}: λ=${best.lambda} val AUROC ${best.auc.toFixed(4)}`);
  }
  candidates[feat === 'dino' ? 'C-lr' : 'A-lr'] = {
    scorer: (r) => ({ firearm: fns.firearm(r[feat]), blade: fns.blade(r[feat]) }),
    note: feat === 'dino' ? 'logistic regression on DINOv2 (on device already)' : 'logistic regression on SigLIP (needs +99.5 MB on device)',
    head: head as Record<Cat, { w: number[]; b: number; lambda: number }>,
  };
}
{
  const fns: Record<string, (x: number[]) => number> = {};
  for (const c of CATS) {
    const tr = train.filter((r) => r.e.label === c || r.e.label === 'safe');
    const vs = val.filter((r) => r.e.label === c || r.e.label === 'safe');
    fns[c] = fitMLP(tr.map((r) => r.dino), yOf(tr, c), vs.map((r) => r.dino), yOf(vs, c)).score;
  }
  candidates['C-mlp'] = { scorer: (r) => ({ firearm: fns.firearm(r.dino), blade: fns.blade(r.dino) }), note: 'MLP 384→32→1 on DINOv2' };
}
{
  let best = { auc: -1, temp: 0 };
  for (const temp of [10, 30, 100]) {
    const zs = zeroShot(temp);
    const s = val.map((r) => { const z = zs(r.siglip); return Math.max(z.firearm, z.blade); });
    const auc = auroc(s.filter((_, i) => val[i].e.label !== 'safe'), s.filter((_, i) => val[i].e.label === 'safe'));
    if (auc > best.auc) best = { auc, temp };
  }
  const zs = zeroShot(best.temp);
  candidates['A-zs'] = { scorer: (r) => zs(r.siglip), note: `SigLIP zero-shot, ${Object.values(PROMPTS).flat().length} prompts, temperature ${best.temp}` };
}

// ---------------- evaluate on test ----------------
const report: Record<string, any> = {};
const anyWeapon = (s: Record<Cat, number>) => Math.max(s.firearm, s.blade);
for (const [name, cand] of Object.entries(candidates)) {
  const sv = val.map((r) => cand.scorer(r)), st = test.map((r) => cand.scorer(r));
  const sj = juyo.ids.map((_, i) => cand.scorer({ dino: juyo.dino[i], siglip: juyo.siglip[i] }));
  const cats: Record<string, any> = {};
  const tBlock: Record<string, number> = {}, tReview: Record<string, number> = {};
  for (const c of CATS) {
    const posV = sv.filter((_, i) => val[i].e.label === c).map((s) => s[c]);
    const negV = sv.filter((_, i) => val[i].e.label === 'safe').map((s) => s[c]);
    const posT = st.filter((_, i) => test[i].e.label === c).map((s) => s[c]);
    const negT = st.filter((_, i) => test[i].e.label === 'safe').map((s) => s[c]);
    tReview[c] = thresholdForRecall(posV, 0.98);
    tBlock[c] = thresholdForBlock(posV, negV, 0.99);
    const blk = at(posT, negT, tBlock[c]);
    cats[c] = {
      aurocTest: auroc(posT, negT), nPosTest: posT.length, nNegTest: negT.length,
      review: { threshold: tReview[c], ...at(posT, negT, tReview[c]) },
      block: { threshold: tBlock[c], ...blk, precisionWilsonLow: wilsonLow(blk.tp, blk.tp + blk.fp) },
      juyoReview: sj.filter((s) => s[c] >= tReview[c]).length, juyoBlock: sj.filter((s) => s[c] >= tBlock[c]).length,
    };
  }
  // the product decision: SAFE only if no category reaches its review threshold
  const flagged = (s: Record<Cat, number>) => CATS.some((c) => s[c] >= tReview[c]);
  const blocked = (s: Record<Cat, number>) => CATS.some((c) => s[c] >= tBlock[c]);
  const isW = (i: number) => test[i].e.label !== 'safe';
  const conf = { weaponSafe: 0, weaponReview: 0, weaponBlock: 0, safeSafe: 0, safeReview: 0, safeBlock: 0 };
  st.forEach((s, i) => {
    const d = blocked(s) ? 'Block' : flagged(s) ? 'Review' : 'Safe';
    conf[`${isW(i) ? 'weapon' : 'safe'}${d}` as keyof typeof conf]++;
  });
  report[name] = {
    note: cand.note,
    aurocAnyWeapon: auroc(st.filter((_, i) => isW(i)).map(anyWeapon), st.filter((_, i) => !isW(i)).map(anyWeapon)),
    categories: cats, decisionsTest: conf,
    juyo: { n: sj.length, review: sj.filter((s) => flagged(s) && !blocked(s)).length, block: sj.filter(blocked).length },
    thresholds: { review: tReview, block: tBlock },
  };
  // hard negatives that were flagged, by tag — what the model confuses
  const confused: Record<string, number> = {};
  st.forEach((s, i) => { if (!isW(i) && flagged(s)) for (const t of test[i].e.tags.length ? test[i].e.tags : ['(random)']) confused[t] = (confused[t] ?? 0) + 1; });
  report[name].falsePositiveTags = Object.fromEntries(Object.entries(confused).sort((a, b) => b[1] - a[1]).slice(0, 12));
  if (cand.head) report[name].head = cand.head;
  const flaggedJuyo = sj.map((s, i) => [i, s] as const).filter(([, s]) => flagged(s)).map(([i, s]) => ({ index: i, id: juyo.ids[i], firearm: +s.firearm.toFixed(4), blade: +s.blade.toFixed(4) }));
  report[name].juyoFlagged = flaggedJuyo;
}

// latency of the extra step on top of the vector: negligible for C (a dot product)
const lat = (f: () => void) => { const t0 = performance.now(); for (let i = 0; i < 1000; i++) f(); return (performance.now() - t0) / 1000; };
for (const name of Object.keys(report)) report[name].headMsPerImage = lat(() => candidates[name].scorer(test[0]));
report.perf = emb.perf;
report.dataset = { train: train.length, val: val.length, test: test.length, byLabel: Object.fromEntries(['firearm', 'blade', 'safe'].map((l) => [l, ['train', 'val', 'test'].map((s) => rows.filter((r) => r.e.label === l && r.e.split === s).length)])) };
await writeFile(path.join(OUT, 'results.json'), JSON.stringify(report, null, 1));
for (const [name, r] of Object.entries(report)) {
  if (!r.categories) continue;
  console.log(`\n${name} — ${r.note}\n  AUROC(any weapon) ${r.aurocAnyWeapon.toFixed(4)}  decisions on test: ${JSON.stringify(r.decisionsTest)}  JUYO: review ${r.juyo.review}, block ${r.juyo.block} of ${r.juyo.n}`);
  for (const c of CATS) {
    const x = r.categories[c];
    console.log(`  ${c.padEnd(8)} AUROC ${x.aurocTest.toFixed(4)} | REVIEW t=${x.review.threshold.toFixed(4)} P ${x.review.precision.toFixed(3)} R ${x.review.recall.toFixed(3)} F1 ${x.review.f1.toFixed(3)} FPR ${x.review.fpr.toFixed(3)} FNR ${x.review.fnr.toFixed(3)} | BLOCK t=${x.block.threshold.toFixed(4)} TP ${x.block.tp} FP ${x.block.fp} R ${x.block.recall.toFixed(3)} P ${x.block.precision.toFixed(3)} (≥${x.block.precisionWilsonLow.toFixed(3)})`);
  }
  console.log(`  confused: ${JSON.stringify(r.falsePositiveTags)}`);
}
