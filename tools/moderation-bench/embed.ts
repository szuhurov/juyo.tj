// Image vectors for the moderation benchmark, made exactly as the devices make them.
//
//   node embed.ts <dataset-dir> <out.json>
//
// <dataset-dir>: list.json ([{ id }] or [{ id, ... }]) + img/<id>.jpg, or the
// JUYO set (list.json + img/<index>.jpg). Two models:
//   - dino:   the visual-search model the phone and browser already run
//             (lib/visual-model.ts — same file, same preprocessing, CLS, L2);
//   - siglip: SigLIP base/16 vision (option A, zero-shot), pooler output, L2.
// Everything runs locally with onnxruntime-web (WASM); no network.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import * as ort from 'onnxruntime-web';
import { toTensor, l2normalize, type Pixels, type PreprocessSpec } from '../../lib/visual-preprocess.ts';
import { VISUAL_MODEL } from '../../lib/visual-model.ts';

const [DATA, OUT] = process.argv.slice(2);
if (!DATA || !OUT) throw new Error('usage: node embed.ts <dataset-dir> <out.json>');
ort.env.wasm.numThreads = Number(process.env.THREADS ?? Math.min(8, os.cpus().length));

const WEB = path.join(import.meta.dirname, '..', '..');
export const MODELS = {
  dino: {
    file: path.join(WEB, 'public', 'models', 'visual', VISUAL_MODEL.file),
    sha256: VISUAL_MODEL.sha256,
    spec: VISUAL_MODEL.spec,
    output: (o: ort.InferenceSession.OnnxValueMapType) => (o[VISUAL_MODEL.output].data as Float32Array).slice(0, VISUAL_MODEL.outputLength),
  },
  siglip: {
    file: path.join(WEB, 'services', 'vision', 'models', 'siglip_vision_q.onnx'),
    sha256: 'ef14a954f3d57e1806666432bd9785004c1dc27100aa260eee0cb0f10a5de058',
    spec: { size: 224, mode: 'squash', mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5] } as PreprocessSpec,
    output: (o: ort.InferenceSession.OnnxValueMapType) => o.pooler_output.data as Float32Array,
  },
};

const list: { id: string }[] = JSON.parse(await readFile(path.join(DATA, 'list.json'), 'utf8'));
const imgPath = (i: number) => {
  const byId = path.join(DATA, 'img', `${list[i].id}.jpg`);
  return existsSync(byId) ? byId : path.join(DATA, 'img', `${i}.jpg`);
};

async function decode(file: string): Promise<Pixels> {
  const { data, info } = await sharp(await readFile(file)).rotate().removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: 3 };
}

const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
const result: Record<string, unknown> = { ids: list.map((e) => e.id) };
const perf: Record<string, unknown> = {};
for (const [name, m] of Object.entries(MODELS)) {
  const bytes = await readFile(m.file);
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== m.sha256) throw new Error(`${name}: checksum mismatch (${sha})`);
  const t0 = performance.now();
  const session = await ort.InferenceSession.create(bytes, { graphOptimizationLevel: 'all' });
  const loadMs = performance.now() - t0;
  const n = m.spec.size;
  const vecs: number[][] = [];
  const pre: number[] = [], inf: number[] = [];
  for (let i = 0; i < list.length; i++) {
    const px = await decode(imgPath(i));
    const a = performance.now();
    const x = toTensor(px, m.spec);
    const b = performance.now();
    const out = await session.run({ pixel_values: new ort.Tensor('float32', x, [1, 3, n, n]) });
    inf.push(performance.now() - b); pre.push(b - a);
    vecs.push(Array.from(l2normalize(m.output(out)), (v) => Math.round(v * 1e6) / 1e6));
    if ((i + 1) % 500 === 0) console.error(`  ${name} ${i + 1}/${list.length}`);
  }
  await session.release();
  result[name] = vecs;
  perf[name] = { sha256: sha, sizeMB: bytes.length / 1e6, loadMs, preprocessMs: med(pre), inferenceMs: med(inf), firstInferenceMs: inf[0], threads: ort.env.wasm.numThreads };
  console.error(`${name}: ${list.length} images, median ${med(inf).toFixed(0)} ms`);
}
result.perf = perf;
await writeFile(OUT, JSON.stringify(result));
