// One-time: gives every published listing photo a small copy for cards
// (600 px, `-thumb.jpg`) and a one-year cache header, like new uploads get
// (lib/listing-photo-upload.ts, app/(tabs)/add.tsx). Runs on the developer's
// computer with the service role from Web/.env.local (never printed).
//
//   node thumbs-backfill.ts            # dry run: lists what it would do
//   node thumbs-backfill.ts --apply    # uploads thumbs, sets thumbnail_url,
//                                      # re-uploads originals (same bytes) with the long cache
//
// Only JUYO's own public bucket; placeholders (juyo.tj) are skipped.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { PHOTO_CACHE_SECONDS } from '../../lib/photo-policy.ts';

const APPLY = process.argv.includes('--apply');
const env = Object.fromEntries(
  readFileSync(path.join(import.meta.dirname, '../../.env.local'), 'utf8')
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; }),
);
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) throw new Error('missing Supabase env in .env.local');
const PUBLIC = `${URL_BASE}/storage/v1/object/public/items/`;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const rows = (await (await fetch(`${URL_BASE}/rest/v1/item_images?select=id,image_url,thumbnail_url`, { headers: H })).json()) as
  { id: string; image_url: string; thumbnail_url: string | null }[];

async function put(objectPath: string, body: Buffer) {
  const res = await fetch(`${URL_BASE}/storage/v1/object/items/${objectPath}`, {
    method: 'POST',
    headers: { ...H, 'content-type': 'image/jpeg', 'cache-control': `max-age=${PHOTO_CACHE_SECONDS}`, 'x-upsert': 'true' },
    body,
  });
  if (!res.ok) throw new Error(`upload ${objectPath}: ${res.status} ${await res.text()}`);
}

let thumbs = 0, originals = 0, skipped = 0, failed = 0;
for (const r of rows) {
  if (!r.image_url.startsWith(PUBLIC)) { skipped++; continue; }
  const objectPath = decodeURIComponent(r.image_url.slice(PUBLIC.length).split('?')[0]);
  const hasThumb = !!r.thumbnail_url && r.thumbnail_url !== r.image_url && r.thumbnail_url.startsWith(PUBLIC);
  try {
    const orig = Buffer.from(await (await fetch(r.image_url)).arrayBuffer());
    if (!hasThumb) {
      const thumbPath = objectPath.replace(/\.[a-z0-9]+$/i, '') + '-thumb.jpg';
      const thumb = await sharp(orig).rotate().resize({ width: 600, withoutEnlargement: true }).jpeg({ quality: 75, mozjpeg: true }).toBuffer();
      console.log(`${APPLY ? 'thumb' : 'would thumb'} ${objectPath} ${(orig.length / 1024) | 0} KB -> ${(thumb.length / 1024) | 0} KB`);
      if (APPLY) {
        await put(thumbPath, thumb);
        const upd = await fetch(`${URL_BASE}/rest/v1/item_images?id=eq.${r.id}`, {
          method: 'PATCH',
          headers: { ...H, 'content-type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ thumbnail_url: PUBLIC + thumbPath.split('/').map(encodeURIComponent).join('/') }),
        });
        if (!upd.ok) throw new Error(`update ${r.id}: ${upd.status}`);
      }
      thumbs++;
    }
    // Same bytes, only the cache header changes; the URL stays the same.
    if (APPLY) await put(objectPath, orig);
    originals++;
  } catch (e) {
    failed++;
    console.log(`FAIL ${objectPath}: ${(e as Error).message}`);
  }
}
console.log(`${APPLY ? 'done' : 'dry run'}: thumbs ${thumbs}, originals ${originals}, skipped ${skipped}, failed ${failed}`);
