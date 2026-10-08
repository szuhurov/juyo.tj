// Draws the foreground boxes found by instance-bench.ts on a few photos, to eyeball them.
//   node instance-viz.ts <objectron-dir> <model-id> [count]
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [DATA, id, count = '12'] = process.argv.slice(2);
const OUT = path.join(import.meta.dirname, 'out', 'instance');
const objs: { views: string[] }[] = JSON.parse(await readFile(path.join(DATA, 'list.json'), 'utf8'));
const emb: { box: number[] | null }[] = JSON.parse(await readFile(path.join(OUT, `emb-${id}.json`), 'utf8'));
await mkdir(path.join(OUT, 'viz'), { recursive: true });
const files = objs.flatMap((o) => o.views);
const step = Math.max(1, Math.floor(files.length / Number(count)));
const tiles: Buffer[] = [];
for (let i = 0; i < files.length && tiles.length < Number(count); i += step) {
  const img = sharp(path.join(DATA, 'img', files[i])).rotate().resize(256, 256, { fit: 'fill' });
  const b = emb[i].box;
  const svg = b
    ? `<svg width="256" height="256"><rect x="${b[0] * 256}" y="${b[1] * 256}" width="${(b[2] - b[0]) * 256}" height="${(b[3] - b[1]) * 256}" fill="none" stroke="#10b981" stroke-width="4"/></svg>`
    : `<svg width="256" height="256"><text x="10" y="30" fill="red" font-size="24">no box</text></svg>`;
  tiles.push(await img.composite([{ input: Buffer.from(svg) }]).png().toBuffer());
}
const cols = 4, rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * 256, height: rows * 256, channels: 3, background: '#fff' } })
  .composite(tiles.map((t, k) => ({ input: t, left: (k % cols) * 256, top: Math.floor(k / cols) * 256 })))
  .jpeg().toFile(path.join(OUT, 'viz', `${id}.jpg`));
console.log('ok');
