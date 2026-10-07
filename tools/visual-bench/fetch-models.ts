// Downloads the benchmark candidates once and checks each file against the
// SHA-256 pinned in models.ts (a changed upstream file fails loudly).
//   node fetch-models.ts <models-dir>
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CANDIDATES } from './models.ts';

const DIR = process.argv[2] ?? path.join(import.meta.dirname, 'models');
await mkdir(DIR, { recursive: true });
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const seen = new Set<string>();
for (const c of CANDIDATES) {
  if (seen.has(c.file)) continue;
  seen.add(c.file);
  const target = path.join(DIR, c.file);
  const have = await readFile(target).catch(() => null);
  if (have && sha(have) === c.sha256) { console.log(`ok   ${c.file}`); continue; }
  const res = await fetch(c.url);
  if (!res.ok) throw new Error(`${c.file}: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (sha(bytes) !== c.sha256) throw new Error(`checksum mismatch for ${c.file}`);
  await writeFile(target, bytes);
  if (c.externalData) {
    const ext = await fetch(c.url.replace(/[^/]+$/, `${path.basename(c.url)}_data`));
    await writeFile(path.join(DIR, c.externalData), new Uint8Array(await ext.arrayBuffer()));
  }
  console.log(`got  ${c.file} — ${c.license}`);
}
