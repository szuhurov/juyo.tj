/**
 * Canonical image preprocessing for visual search (embedding input + pHash).
 *
 * The same photo must give the same vector on iOS, Android, the browser and
 * the developer backfill script, so nothing here relies on a platform
 * resampler: decoding is the only platform step, everything after it is this
 * exact arithmetic (doubles, fixed order). The Swift and Kotlin ports in
 * app/modules/visual-embedding must match it line for line; the golden test
 * (tests/lib/visual-preprocess.test.ts, app/__tests__/visual-preprocess.test.ts)
 * pins the numbers.
 *
 * Pure TypeScript, no dependencies. Kept byte-identical in Web/lib and app/lib
 * (app/__tests__/shared-lib-parity.test.ts checks it).
 */

export interface PreprocessSpec {
  /** Square model input side. */
  size: number;
  /** 'squash' resizes the whole photo to size×size; 'crop' resizes the short side to `resizeTo` and takes the centre. */
  mode: 'squash' | 'crop';
  resizeTo?: number;
  mean: [number, number, number];
  std: [number, number, number];
}

/** Decoded, upright (EXIF orientation applied), 8-bit sRGB pixels. Alpha, if present, is ignored. */
export interface Pixels {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  channels: 3 | 4;
}

/**
 * Box (area-average) resampling of one axis: every output sample is the
 * exact coverage-weighted mean of the source interval it covers. For
 * downscaling this is the anti-aliased "area" filter; it needs no kernel
 * tables, so the three ports cannot drift.
 */
function axisWeights(src: number, dst: number, offset: number, span: number) {
  const scale = span / dst;
  const idx: number[][] = [];
  const w: number[][] = [];
  for (let o = 0; o < dst; o++) {
    const start = offset + o * scale;
    const end = start + scale;
    const i0 = Math.floor(start);
    const i1 = Math.min(src - 1, Math.ceil(end) - 1);
    const is: number[] = [];
    const ws: number[] = [];
    for (let i = i0; i <= i1; i++) {
      const cover = Math.min(end, i + 1) - Math.max(start, i);
      if (cover > 0) {
        is.push(i);
        ws.push(cover / scale);
      }
    }
    idx.push(is);
    w.push(ws);
  }
  return { idx, w };
}

/**
 * Area-resamples the region (x0, y0, cw, ch) of `px` to dw×dh.
 * Returns interleaved RGB doubles in 0–255.
 */
export function resizeArea(px: Pixels, dw: number, dh: number, x0 = 0, y0 = 0, cw = px.width, ch = px.height): Float64Array {
  const { data, width, channels } = px;
  const cols = axisWeights(px.width, dw, x0, cw);
  const rows = axisWeights(px.height, dh, y0, ch);
  // Horizontal pass over only the source rows that are used.
  const usedRows = new Map<number, Float64Array>();
  for (const is of rows.idx) for (const y of is) {
    if (usedRows.has(y)) continue;
    const line = new Float64Array(dw * 3);
    const base = y * width * channels;
    for (let o = 0; o < dw; o++) {
      let r = 0, g = 0, b = 0;
      const is2 = cols.idx[o], ws = cols.w[o];
      for (let k = 0; k < is2.length; k++) {
        const p = base + is2[k] * channels;
        r += data[p] * ws[k];
        g += data[p + 1] * ws[k];
        b += data[p + 2] * ws[k];
      }
      line[o * 3] = r;
      line[o * 3 + 1] = g;
      line[o * 3 + 2] = b;
    }
    usedRows.set(y, line);
  }
  const out = new Float64Array(dw * dh * 3);
  for (let oy = 0; oy < dh; oy++) {
    const is = rows.idx[oy], ws = rows.w[oy];
    for (let k = 0; k < is.length; k++) {
      const line = usedRows.get(is[k])!;
      const wk = ws[k];
      const base = oy * dw * 3;
      for (let i = 0; i < dw * 3; i++) out[base + i] += line[i] * wk;
    }
  }
  return out;
}

/** Region of the source photo the model sees. */
export function cropRegion(width: number, height: number, spec: PreprocessSpec) {
  if (spec.mode === 'squash') return { x: 0, y: 0, w: width, h: height };
  // Centre square of the short side (same region as resize-short-side then centre-crop).
  const resizeTo = spec.resizeTo ?? spec.size;
  const side = Math.min(width, height) * (spec.size / resizeTo);
  return { x: (width - side) / 2, y: (height - side) / 2, w: side, h: side };
}

/** Model input tensor: float32, NCHW, RGB, ((v/255) − mean) / std. */
export function toTensor(px: Pixels, spec: PreprocessSpec): Float32Array {
  const n = spec.size;
  const r = cropRegion(px.width, px.height, spec);
  const rgb = resizeArea(px, n, n, r.x, r.y, r.w, r.h);
  const plane = n * n;
  const out = new Float32Array(3 * plane);
  for (let c = 0; c < 3; c++) {
    const m = spec.mean[c], s = spec.std[c];
    for (let i = 0; i < plane; i++) out[c * plane + i] = (rgb[i * 3 + c] / 255 - m) / s;
  }
  return out;
}

export function l2normalize(v: ArrayLike<number>): number[] {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  return Array.from(v, (x) => x / n);
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export const PH = 32;
const DCT = (() => {
  const t = new Float64Array(8 * PH);
  for (let k = 0; k < 8; k++) for (let n = 0; n < PH; n++) t[k * PH + n] = Math.cos(((2 * n + 1) * k * Math.PI) / (2 * PH));
  return t;
})();

/**
 * 64-bit perceptual hash (16 hex chars): 32×32 area-resampled luma
 * (Rec. 601), 2-D DCT-II, 8×8 low-frequency block, each bit = coefficient >
 * median of the 63 AC terms. Robust to resizing and recompression, not to
 * crops or new viewpoints — it is the near-duplicate signal only.
 */
export function pHash(px: Pixels): string {
  return pHashFromRgb32(resizeArea(px, PH, PH));
}

/** pHash from the 32×32 area-resampled RGB (what the native module returns as `hashInput`). */
export function pHashFromRgb32(rgb: ArrayLike<number>): string {
  const g = new Float64Array(PH * PH);
  for (let i = 0; i < PH * PH; i++) g[i] = 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2];
  const tmp = new Float64Array(8 * PH);
  for (let u = 0; u < 8; u++) for (let y = 0; y < PH; y++) {
    let s = 0;
    for (let x = 0; x < PH; x++) s += g[y * PH + x] * DCT[u * PH + x];
    tmp[u * PH + y] = s;
  }
  const coef: number[] = [];
  for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
    let s = 0;
    for (let y = 0; y < PH; y++) s += tmp[u * PH + y] * DCT[v * PH + y];
    coef.push(s);
  }
  const ac = coef.slice(1).sort((a, b) => a - b);
  const median = ac[31];
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    hex += (((coef[i] > median ? 8 : 0) | (coef[i + 1] > median ? 4 : 0) | (coef[i + 2] > median ? 2 : 0) | (coef[i + 3] > median ? 1 : 0))).toString(16);
  }
  return hex;
}

export function hamming(a: string, b: string) {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}
