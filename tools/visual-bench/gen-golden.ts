// Writes app/lib/visual-golden.json: the cross-platform contract for
// app/visual-check.tsx. Each photo is a JUYO listing photo that is already
// public; its vector and pHash are made here with the production model and
// preprocessing (same code as backfill.ts). A phone must reproduce them
// (cosine > 0.99) — that is what the developer-only check screen measures.
//
//   node gen-golden.ts <urls.json> <models-dir>
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import * as ort from 'onnxruntime-web';
import { toTensor, l2normalize, pHash, type Pixels } from '../../lib/visual-preprocess.ts';
import { VISUAL_MODEL } from '../../lib/visual-model.ts';

const [LIST, MODELS] = process.argv.slice(2);
if (!LIST || !MODELS) throw new Error('usage: node gen-golden.ts <urls.json> <models-dir>');
const SUPABASE_PUBLIC = 'https://aztuszloghjkynukjkaa.supabase.co/storage/v1/object/public/items/';

const bytes = await readFile(path.join(MODELS, VISUAL_MODEL.file));
if (createHash('sha256').update(bytes).digest('hex') !== VISUAL_MODEL.sha256) throw new Error('model checksum mismatch');
const session = await ort.InferenceSession.create(bytes, { graphOptimizationLevel: 'all' });
const n = VISUAL_MODEL.spec.size;

const urls: string[] = JSON.parse(await readFile(LIST, 'utf8'));
const photos = [];
for (const url of urls) {
  if (!url.startsWith(SUPABASE_PUBLIC)) throw new Error(`not a JUYO public photo: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const file = Buffer.from(await res.arrayBuffer());
  const d = await sharp(file, { limitInputPixels: 60_000_000 }).rotate().removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const px: Pixels = { data: d.data, width: d.info.width, height: d.info.height, channels: 3 };
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', toTensor(px, VISUAL_MODEL.spec), [1, 3, n, n]) });
  const raw = out[VISUAL_MODEL.output].data as Float32Array;
  const v = l2normalize(raw.subarray(0, VISUAL_MODEL.outputLength || raw.length));
  photos.push({ url, vector: Array.from(v, (x) => Number(x.toPrecision(8))), phash: pHash(px) });
}
const target = path.resolve(import.meta.dirname, '../../../app/lib/visual-golden.json');
await writeFile(target, JSON.stringify({ model: VISUAL_MODEL.id, photos }) + '\n');
console.log(`${photos.length} photos → ${target}`);
