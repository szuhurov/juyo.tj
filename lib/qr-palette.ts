/**
 * Ready-made color pairs and QR contrast checking.
 *
 * Two reasons for a pair, instead of two separate colors:
 *
 *   1. The user doesn't actually want to pick a hex color — they want it
 *      to "look nice". A ready-made pair does this in one tap.
 *   2. Two random colors can make the QR code UNSCANNABLE. All the pairs
 *      here have been tested.
 */

export type QrPair = { qr: string; bg: string };

/**
 * READY-MADE gradients for QR dots.
 *
 * Why a list, instead of manually picking two colors + an angle: a random
 * pair can make the QR code unscannable, and the user would only find out
 * after PRINTING the sticker. Every pair here passes the `isScannablePair`
 * check — at BOTH of its points.
 *
 * Each pair passes TWO checks:
 *
 *   1. `isScannablePair` — both points read correctly against a light background.
 *   2. a hue difference of at least 70°.
 *
 * The second condition was added later. Without it, the list had pairs
 * whose gradient wasn't visible at all: `#111827 → #4B5563` had only a 6°
 * difference, `#065F46 → #166534` — 20°. They looked like a single color to the eye.
 *
 * The order is MANUAL — it was originally picked by hue difference, but
 * later the user reordered it themselves by aesthetics. The first one becomes the Pro default.
 *
 * The angle is fixed per pair: 45° looks natural for most, but vertical
 * pairs (135°) look better.
 */
export type QrGradient = {
  from: string;
  to: string;
  angle: number;
  /**
   * The split between the two colors' area. 1 = mathematically equal, >1 gives
   * the SECOND color more area, <1 gives the FIRST.
   *
   * Needed because mathematical equality isn't equality to the EYE: the
   * midpoint blend creates a third hue, and it appears closer to one of
   * the two edges — that edge then reads as having more area. In this
   * list, bright purple almost always dominates.
   *
   * The values were picked BY EYE, not by formula: two models (LAB
   * distance to the midpoint, and hue) were tried and neither reproduced
   * the observed result — for the first pair they gave 1.08 and 1.22,
   * while what was actually needed was 1.7.
   */
  bias?: number;
  /**
   * Which edge colors the SOLID-color parts — the corner eyes, the JUYO
   * logo, and the bottom text. Defaults to `from`.
   *
   * These are outside the gradient and need one fixed color. Always
   * taking `from` is wrong: when `bias` > 1, the pure `from` color doesn't
   * exist anywhere in the QR code itself, so the eyes would get a color
   * that isn't in the image.
   */
  accent?: 'from' | 'to';
};

const QR_GRADIENT_BASE: QrGradient[] = [
  { from: '#2563EB', to: '#DB2777', angle: 225 },// blue → pink · Δ112°
  // Green dominates: it takes up more area in the QR code, so purple eyes on it looked out of place.
  { from: '#7C3AED', to: '#059669', angle: 135, bias: 1.7, accent: 'to' },// purple → green · Δ101°
  { from: '#DC2626', to: '#7C3AED', angle: 45, bias: 0.85 },// red → purple · Δ98°
  { from: '#0F766E', to: '#7C3AED', angle: 135, bias: 0.85 },// teal → purple · Δ87°
  { from: '#6D28D9', to: '#0891B2', angle: 45, bias: 1.2 },// purple → teal · Δ72°
  { from: '#7C3AED', to: '#DB2777', angle: 45 },// purple → pink · Δ71°
];

/**
 * Angle in degrees → two gradient points in 0..1 space.
 *
 * y increases DOWNWARD in SVG, so 45° puts the first color at top-left and
 * the second at bottom-right. Increasing the angle rotates CLOCKWISE.
 *
 * This stays here, not in `QrDesignCard`: both the sticker and the
 * selection previews must use the exact same calculation, otherwise the
 * preview would show something the QR code doesn't have.
 */
export function gradientPoints(deg: number, bias = 1) {
  const rad = (deg * Math.PI) / 180;
  const dx = Math.cos(rad) / 2;
  const dy = Math.sin(rad) / 2;
  // The start point is pushed OUTSIDE the frame: this way, inside the QR
  // code the transition already appears to have started, and the first
  // color takes up less area. The end point is left untouched, otherwise
  // the second color would get cut off too.
  return {
    start: [0.5 - dx * bias, 0.5 - dy * bias] as [number, number],
    end: [0.5 + dx, 0.5 + dy] as [number, number],
  };
}

/**
 * Each pair appears FOUR times — with the same colors, just rotated.
 *
 * Each step is 90° clockwise: the first color moves from one corner to
 * another, and after four steps returns to its original spot. This brings
 * the list from 7 up to 28 entries without introducing any new color —
 * the same tested pairs, just in a different orientation.
 */
export const QR_GRADIENTS: QrGradient[] = QR_GRADIENT_BASE.flatMap((g) =>
  [0, 90, 180, 270].map((turn) => ({ ...g, angle: (g.angle + turn) % 360 })),
);

export const QR_PAIRS: QrPair[] = [
  { qr: '#26BA90', bg: '#EEFBF5' }, // JUYO — default
  { qr: '#111827', bg: '#FFFFFF' }, // classic
  { qr: '#1D4ED8', bg: '#EFF6FF' },
  { qr: '#7C3AED', bg: '#F5F3FF' },
  { qr: '#DB2777', bg: '#FDF2F8' },
  { qr: '#EA580C', bg: '#FFF7ED' },
  { qr: '#0F766E', bg: '#F0FDFA' },
  { qr: '#FFFFFF', bg: '#111827' }, // inverted — dark
];

/** `#RGB` or `#RRGGBB` → [r, g, b] in 0…255. */
function toRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance per WCAG. */
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The luminance difference between two colors: 0 (identical) … 1 (black and white).
 *
 * DELIBERATELY not the WCAG contrast ratio.
 *
 * WCAG is built for a HUMAN READING TEXT and heavily penalizes bright
 * colors. Scanning a QR code is a different problem: the camera sees the
 * REFLECTANCE difference, and ISO 18004 requires exactly that — at least 40%.
 *
 * The difference shows up in practice too. The JUYO default pair
 * (`#26BA90` / `#EEFBF5`) gives only 2.32:1 by WCAG — which would count as
 * "bad" — while it has scanned without issue for years. By luminance
 * difference it's 0.56 — well above the threshold.
 */
export function luminanceDelta(a: string, b: string): number {
  return Math.abs(luminance(a) - luminance(b));
}

/**
 * Text color that reads well on top of a given color.
 *
 * Same luminance calculation: dark background → white text, light → black.
 * This is needed for colored buttons — a FIXED text color was illegible in half the cases.
 */
export function readableTextOn(hex: string): string {
  return luminance(hex) > 0.45 ? '#111827' : '#FFFFFF';
}

/**
 * Lower threshold — the same 40% from ISO 18004.
 *
 * In testing this clearly separates the bad pairs:
 *
 *     JUYO default    0.56  ✓
 *     black / white   0.99  ✓
 *     green / green   0.18  ✗
 *     gray            0.30  ✗
 *     yellow / white  0.25  ✗
 */
export const MIN_QR_LUMINANCE_DELTA = 0.4;

/**
 * Is this pair good enough for scanning?
 *
 * This isn't a matter of aesthetics: the user could PRINT an unscannable
 * sticker and only find out after sticking it on the item.
 */
export function isScannablePair(qr: string, bg: string): boolean {
  return luminanceDelta(qr, bg) >= MIN_QR_LUMINANCE_DELTA;
}

/**
 * Is the color very close to white?
 *
 * For color-picker circles/swatches: if a color is fully white (or nearly
 * white), it gets lost against the card's white background. A border is
 * needed ONLY in this case — for other colors it would be excessive.
 */
export function isNearWhite(hex: string): boolean {
  return luminance(hex) > 0.9;
}
