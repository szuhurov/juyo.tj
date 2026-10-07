import { describe, expect, it } from "vitest";
import { cropRegion, cosine, hamming, l2normalize, pHash, pHashFromRgb32, resizeArea, toTensor, type Pixels } from "@/lib/visual-preprocess";

// A fixed synthetic image. The pinned numbers below are the contract the
// Swift/Kotlin ports (app/modules/visual-embedding) and app/lib copy must
// reproduce bit for bit — change them only together with VISUAL_MODEL's
// preprocess version.
function pattern(w = 37, h = 23, channels: 3 | 4 = 3): Pixels {
  const data = new Uint8Array(w * h * channels);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * channels;
    data[o] = (x * 7 + y * 3) % 256;
    data[o + 1] = (x * x + y * 11) % 256;
    data[o + 2] = ((x ^ y) * 13) % 256;
    if (channels === 4) data[o + 3] = 255;
  }
  return { data, width: w, height: h, channels };
}

const SPEC = { size: 8, mode: "squash" as const, mean: [0.485, 0.456, 0.406] as [number, number, number], std: [0.229, 0.224, 0.225] as [number, number, number] };
const sum = (xs: ArrayLike<number>) => Array.from(xs).reduce((a, b) => a + b, 0);

describe("resizeArea", () => {
  it("is the identity at the same size", () => {
    const px = pattern(5, 4);
    expect(Array.from(resizeArea(px, 5, 4))).toEqual(Array.from(px.data));
  });

  it("averages exact 2×2 blocks when halving", () => {
    const px = pattern(4, 4);
    const out = resizeArea(px, 2, 2);
    const at = (x: number, y: number, c: number) => px.data[(y * 4 + x) * 3 + c];
    expect(out[0]).toBeCloseTo((at(0, 0, 0) + at(1, 0, 0) + at(0, 1, 0) + at(1, 1, 0)) / 4, 12);
    expect(out[3 * 3 + 2]).toBeCloseTo((at(2, 2, 2) + at(3, 2, 2) + at(2, 3, 2) + at(3, 3, 2)) / 4, 12);
  });

  it("keeps a flat image flat at any scale (weights sum to 1)", () => {
    const px: Pixels = { data: new Uint8Array(19 * 11 * 3).fill(200), width: 19, height: 11, channels: 3 };
    for (const v of resizeArea(px, 7, 13)) expect(v).toBeCloseTo(200, 10);
  });

  it("ignores alpha (RGBA and RGB give the same result)", () => {
    expect(Array.from(resizeArea(pattern(37, 23, 4), 8, 8))).toEqual(Array.from(resizeArea(pattern(37, 23, 3), 8, 8)));
  });

  it("matches the pinned golden values", () => {
    const r = resizeArea(pattern(), 32, 32);
    expect(r[0]).toBeCloseTo(0.945946, 5);
    expect(r[1000]).toBeCloseTo(51.027027, 5);
  });
});

describe("toTensor", () => {
  it("is NCHW float32 with ((v/255) − mean) / std", () => {
    const px: Pixels = { data: new Uint8Array(3 * 3 * 3).fill(255), width: 3, height: 3, channels: 3 };
    const t = toTensor(px, { ...SPEC, size: 2 });
    expect(t).toBeInstanceOf(Float32Array);
    expect(t.length).toBe(12);
    expect(t[0]).toBeCloseTo((1 - 0.485) / 0.229, 5);
    expect(t[4]).toBeCloseTo((1 - 0.456) / 0.224, 5);
    expect(t[8]).toBeCloseTo((1 - 0.406) / 0.225, 5);
  });

  it("matches the pinned golden values (squash and centre crop)", () => {
    const t = toTensor(pattern(), SPEC);
    expect(sum(t)).toBeCloseTo(21.775571, 3);
    expect(t[0]).toBeCloseTo(-1.848456, 5);
    expect(t[100]).toBeCloseTo(-0.031954, 5);
    expect(t[191]).toBeCloseTo(1.183874, 5);
    const c = toTensor(pattern(), { ...SPEC, mode: "crop", resizeTo: 10 });
    expect(sum(c)).toBeCloseTo(46.542405, 3);
    expect(c[5]).toBeCloseTo(0.603443, 5);
  });

  it("crop takes the centre square of the short side", () => {
    expect(cropRegion(400, 300, { ...SPEC, size: 224, mode: "crop", resizeTo: 256 })).toEqual({ x: 68.75, y: 18.75, w: 262.5, h: 262.5 });
    expect(cropRegion(400, 300, SPEC)).toEqual({ x: 0, y: 0, w: 400, h: 300 });
  });
});

describe("pHash", () => {
  it("matches the pinned golden hash", () => {
    expect(pHash(pattern())).toBe("95010ef80ffa575a");
    expect(pHashFromRgb32(resizeArea(pattern(), 32, 32))).toBe("95010ef80ffa575a");
  });

  it("barely changes when the same scene is rendered at another size, and differs for another scene", () => {
    // a smooth scene sampled at two resolutions, like a photo and its resized copy
    const render = (w: number, h: number, shift = 0): Pixels => {
      const data = new Uint8Array(w * h * 3);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const blob = Math.exp(-(((u - 0.35 - shift) ** 2) + (v - 0.5) ** 2) / 0.02);
        const o = (y * w + x) * 3;
        data[o] = 40 + 180 * blob;
        data[o + 1] = 60 + 120 * u;
        data[o + 2] = 200 - 150 * v;
      }
      return { data, width: w, height: h, channels: 3 };
    };
    expect(hamming(pHash(render(300, 200)), pHash(render(150, 100)))).toBeLessThanOrEqual(4);
    expect(hamming(pHash(render(300, 200)), pHash(render(300, 200, 0.3)))).toBeGreaterThan(8);
  });

  it("hamming counts differing bits", () => {
    expect(hamming("0000000000000000", "000000000000000f")).toBe(4);
    expect(hamming("ffffffffffffffff", "0000000000000000")).toBe(64);
  });
});

describe("vectors", () => {
  it("l2normalize gives unit length and cosine of a vector with itself is 1", () => {
    const v = l2normalize([3, 4]);
    expect(v).toEqual([0.6, 0.8]);
    expect(cosine(v, v)).toBeCloseTo(1, 12);
  });
});
