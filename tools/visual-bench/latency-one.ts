// Median single-photo inference time of one model file at one input size.
//   THREADS=4 node latency-one.ts <models-dir> <file> <size>
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as ort from 'onnxruntime-web';

const [MODELS, file, size] = process.argv.slice(2);
ort.env.wasm.numThreads = Number(process.env.THREADS ?? 4);
const n = Number(size);
const s = await ort.InferenceSession.create(await readFile(path.join(MODELS, file)), { graphOptimizationLevel: 'all' });
const x = new ort.Tensor('float32', new Float32Array(3 * n * n).map((_, i) => Math.sin(i)), [1, 3, n, n]);
for (let k = 0; k < 2; k++) await s.run({ [s.inputNames[0]]: x });
const ts: number[] = [];
for (let k = 0; k < 7; k++) { const t = performance.now(); await s.run({ [s.inputNames[0]]: x }); ts.push(performance.now() - t); }
ts.sort((a, b) => a - b);
console.log(`${file} @${n}: median ${ts[3].toFixed(0)} ms (threads ${ort.env.wasm.numThreads}), rss ${(process.memoryUsage().rss / 1e6).toFixed(0)} MB`);
