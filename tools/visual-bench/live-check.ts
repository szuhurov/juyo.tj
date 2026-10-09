// End-to-end check of search by photo against a running site.
//   node live-check.ts <images.json> <models-dir> [site] [count]
// For a few published photos: makes an edited copy (crop, small rotation,
// light change), embeds it here exactly like a device would, POSTs only the
// vector to <site>/api/search/image and reports where the photo's own
// listing ranks.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import * as ort from 'onnxruntime-web';
import { toTensor, l2normalize, pHash, type Pixels } from '../../lib/visual-preprocess.ts';
import { VISUAL_MODEL } from '../../lib/visual-model.ts';

const [LIST, MODELS, SITE = 'https://juyo.tj', COUNT = '8'] = process.argv.slice(2);
const rows: { id: string; item_id: string; image_url: string }[] = JSON.parse(await readFile(LIST, 'utf8'));
ort.env.wasm.numThreads = 4;
const session = await ort.InferenceSession.create(await readFile(path.join(MODELS, VISUAL_MODEL.file)), { graphOptimizationLevel: 'all' });
const n = VISUAL_MODEL.spec.size;

const step = Math.max(1, Math.floor(rows.length / Number(COUNT)));
let top1 = 0, found = 0, tried = 0;
for (let k = 0; k < rows.length && tried < Number(COUNT); k += step) {
  const r = rows[k];
  const orig = Buffer.from(await (await fetch(r.image_url)).arrayBuffer());
  const m = await sharp(orig).rotate().metadata();
  const W = m.width!, H = m.height!;
  const edited = await sharp(orig).rotate()
    .extract({ left: Math.round(W * 0.08), top: Math.round(H * 0.06), width: Math.round(W * 0.84), height: Math.round(H * 0.86) })
    .rotate(8, { background: '#808080' }).modulate({ brightness: 0.85 }).jpeg({ quality: 80 }).toBuffer();
  const d = await sharp(edited).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const px: Pixels = { data: d.data, width: d.info.width, height: d.info.height, channels: 3 };
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', toTensor(px, VISUAL_MODEL.spec), [1, 3, n, n]) });
  const raw = out[VISUAL_MODEL.output].data as Float32Array;
  const vector = l2normalize(raw.subarray(0, VISUAL_MODEL.outputLength || raw.length));
  const res = await fetch(`${SITE}/api/search/image`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: VISUAL_MODEL.id, vector, phash: pHash(px) }) });
  const body = (await res.json()) as { items?: { id: string; visual: { score: number; reasons: string[] } }[]; error?: string };
  tried++;
  const rank = (body.items ?? []).findIndex((i) => i.id === r.item_id) + 1;
  if (rank === 1) top1++;
  if (rank > 0) found++;
  const hit = rank > 0 ? body.items![rank - 1].visual : null;
  console.log(`${res.status} results=${body.items?.length ?? body.error} rank=${rank || '-'} ${hit ? `${hit.reasons[0]} ${hit.score}` : ''}`);
}
console.log(`own listing first: ${top1}/${tried}, found: ${found}/${tried}`);
