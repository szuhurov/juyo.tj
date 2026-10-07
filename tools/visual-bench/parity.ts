// Decoder-sensitivity check for the cross-platform contract.
//
//   node parity.ts <dataset-dir> <models-dir> <model-id> [n]
//
// The only platform-specific step in lib/visual-preprocess.ts is JPEG
// decoding (iOS ImageIO, Android libjpeg-turbo/Skia, browsers). This decodes
// the same files with two unrelated decoders — libjpeg-turbo (sharp) and a
// pure-JS decoder (jpeg-js, different IDCT and chroma upsampling) — and
// reports how far the model input and the final vectors move. It bounds what
// a different phone decoder can do; the on-device check (app diagnostics)
// measures the real thing.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import jpeg from 'jpeg-js';
import * as ort from 'onnxruntime-web';
import { toTensor, l2normalize, cosine, pHash, hamming, type Pixels } from '../../lib/visual-preprocess.ts';
import { CANDIDATES } from './models.ts';

const [DATA, MODELS, id, nArg] = process.argv.slice(2);
const c = CANDIDATES.find((m) => m.id === id);
if (!c) throw new Error(`unknown model ${id}`);
const n = Number(nArg ?? 30);
ort.env.wasm.numThreads = 4;

const opts: ort.InferenceSession.SessionOptions = { graphOptimizationLevel: 'all' };
if (c.externalData) opts.externalData = [{ path: c.externalData, data: await readFile(path.join(MODELS, c.externalData)) }];
const session = await ort.InferenceSession.create(await readFile(path.join(MODELS, c.file)), opts);
const size = c.spec.size;
const embed = async (px: Pixels) => {
  const out = await session.run({ pixel_values: new ort.Tensor('float32', toTensor(px, c.spec), [1, 3, size, size]) });
  const name = c.pooling === 'pooler' ? 'pooler_output' : c.pooling === 'image_embeds' ? 'image_embeds' : 'last_hidden_state';
  const data = out[name].data as Float32Array;
  return l2normalize(c.pooling === 'cls' ? data.subarray(0, (out[name].dims as number[])[2]) : data);
};

const cos: number[] = [], maxAbs: number[] = [], ham: number[] = [], cosNoise: number[] = [];
// ±1 level per channel: the size of rounding differences between two
// conforming libjpeg-family decoders (IDCT / colour conversion rounding).
let seed = 1;
const noise = (px: Pixels): Pixels => {
  const d = Uint8Array.from(px.data);
  for (let k = 0; k < d.length; k++) { seed = (seed * 1664525 + 1013904223) >>> 0; const r = seed % 3; d[k] = Math.max(0, Math.min(255, d[k] + r - 1)); }
  return { ...px, data: d };
};
for (let i = 0; i < n; i++) {
  const bytes = await readFile(path.join(DATA, 'img', `${i}.jpg`));
  const a = await sharp(bytes).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pa: Pixels = { data: a.data, width: a.info.width, height: a.info.height, channels: 3 };
  const j = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  const pb: Pixels = { data: j.data, width: j.width, height: j.height, channels: 4 };
  if (pa.width !== pb.width || pa.height !== pb.height) { console.log(`skip ${i}: EXIF-rotated (jpeg-js ignores orientation)`); continue; }
  const ta = toTensor(pa, c.spec), tb = toTensor(pb, c.spec);
  let m = 0;
  for (let k = 0; k < ta.length; k++) m = Math.max(m, Math.abs(ta[k] - tb[k]));
  maxAbs.push(m);
  const ea = await embed(pa);
  cos.push(cosine(ea, await embed(pb)));
  cosNoise.push(cosine(ea, await embed(noise(pa))));
  ham.push(hamming(pHash(pa), pHash(pb)));
}
const s = (xs: number[]) => [...xs].sort((x, y) => x - y);
console.log(JSON.stringify({
  model: id, photos: cos.length,
  vectorCosine: { min: s(cos)[0], median: s(cos)[cos.length >> 1] },
  vectorCosinePlusMinus1: { min: s(cosNoise)[0], median: s(cosNoise)[cosNoise.length >> 1] },
  tensorMaxAbsDiff: { max: s(maxAbs).at(-1), median: s(maxAbs)[maxAbs.length >> 1] },
  pHashHamming: { max: s(ham).at(-1), mean: ham.reduce((x, y) => x + y, 0) / ham.length },
}, null, 1));
