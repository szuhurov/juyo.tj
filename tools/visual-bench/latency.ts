// Clean CPU latency / memory per candidate (one model per process, nothing
// else running). Desktop WASM numbers — a proxy for the browser; phones
// must be measured on the device (app/app/visual-check.tsx).
//
//   node latency.ts <models-dir> <model-id> [threads]
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as ort from 'onnxruntime-web';
import { CANDIDATES } from './models.ts';

const [MODELS, id, threads = '1'] = process.argv.slice(2);
const c = CANDIDATES.find((m) => m.id === id);
if (!c) throw new Error(`unknown model ${id}`);
ort.env.wasm.numThreads = Number(threads);
const rss0 = process.memoryUsage().rss;
const opts: ort.InferenceSession.SessionOptions = { graphOptimizationLevel: 'all' };
if (c.externalData) opts.externalData = [{ path: c.externalData, data: await readFile(path.join(MODELS, c.externalData)) }];
const t0 = performance.now();
const s = await ort.InferenceSession.create(await readFile(path.join(MODELS, c.file)), opts);
const loadMs = performance.now() - t0;
const n = c.spec.size;
const x = new ort.Tensor('float32', new Float32Array(3 * n * n).map((_, i) => Math.sin(i) * 0.5), [1, 3, n, n]);
await s.run({ pixel_values: x });
const times: number[] = [];
let peak = process.memoryUsage().rss;
for (let k = 0; k < 10; k++) {
  const t = performance.now();
  await s.run({ pixel_values: x });
  times.push(performance.now() - t);
  peak = Math.max(peak, process.memoryUsage().rss);
}
times.sort((a, b) => a - b);
const { size } = await import('node:fs').then((fs) => fs.statSync(path.join(MODELS, c.file)));
console.log(JSON.stringify({ id, threads: Number(threads), fileMB: +(size / 1e6).toFixed(1), loadMs: Math.round(loadMs), medianMs: Math.round(times[5]), p90Ms: Math.round(times[8]), rssDeltaMB: Math.round((peak - rss0) / 1e6) }));
