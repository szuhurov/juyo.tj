// One-time backfill of visual-search vectors for photos published before
// devices made them, run on the developer's computer (owner decision
// 2026-10-06). No photo goes anywhere: each published photo is downloaded
// from JUYO's own public bucket, embedded here with the production model and
// preprocessing, and only the vectors are written out as SQL.
//
//   node backfill.ts <images.json> <models-dir> > out/backfill.sql
//
// images.json: [{ "id": <item_images.id>, "item_id": ..., "image_url": ... }]
// (select id, item_id, image_url from item_images). Apply the SQL with the
// service role (Supabase SQL editor / MCP). Re-running is safe: it upserts.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import * as ort from 'onnxruntime-web';
import { toTensor, l2normalize, pHash, type Pixels } from '../../lib/visual-preprocess.ts';
import { VISUAL_MODEL } from '../../lib/visual-model.ts';

const [LIST, MODELS] = process.argv.slice(2);
if (!LIST || !MODELS) throw new Error('usage: node backfill.ts <images.json> <models-dir>');
const SUPABASE_PUBLIC = 'https://aztuszloghjkynukjkaa.supabase.co/storage/v1/object/public/items/';

const bytes = await readFile(path.join(MODELS, VISUAL_MODEL.file));
if (createHash('sha256').update(bytes).digest('hex') !== VISUAL_MODEL.sha256) throw new Error('model checksum mismatch');
ort.env.wasm.numThreads = 4;
const session = await ort.InferenceSession.create(bytes, { graphOptimizationLevel: 'all' });
const n = VISUAL_MODEL.spec.size;

const rows: { id: string; item_id: string; image_url: string }[] = JSON.parse(await readFile(LIST, 'utf8'));
const uuid = /^[0-9a-f-]{36}$/;
console.log('-- visual-search backfill', VISUAL_MODEL.id, new Date().toISOString());
let ok = 0;
for (const r of rows) {
  if (!uuid.test(r.id) || !uuid.test(r.item_id)) continue;
  // Only JUYO's own bucket — never fetch an arbitrary URL from the table.
  if (!r.image_url.startsWith(SUPABASE_PUBLIC)) { console.log(`-- skip ${r.id}: not in the items bucket`); continue; }
  try {
    const res = await fetch(r.image_url);
    if (!res.ok) throw new Error(String(res.status));
    const file = Buffer.from(await res.arrayBuffer());
    const d = await sharp(file, { limitInputPixels: 60_000_000 }).rotate().removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
    const px: Pixels = { data: d.data, width: d.info.width, height: d.info.height, channels: 3 };
    const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', toTensor(px, VISUAL_MODEL.spec), [1, 3, n, n]) });
    const raw = out[VISUAL_MODEL.output].data as Float32Array;
    const v = l2normalize(raw.subarray(0, VISUAL_MODEL.outputLength || raw.length));
    const arr = `'{${v.map((x) => x.toPrecision(8)).join(',')}}'::real[]`;
    console.log(`select public.admin_set_image_embedding('${r.id}', '${r.item_id}', '${VISUAL_MODEL.id}', ${arr}, '${pHash(px)}', 'backfill');`);
    ok++;
  } catch (e) {
    console.log(`-- skip ${r.id}: ${(e as Error).message}`);
  }
}
console.log(`-- ${ok}/${rows.length} vectors`);
