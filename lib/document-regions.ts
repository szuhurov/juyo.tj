/**
 * Turns on-device detection results (text lines, eyes) into the regions the
 * privacy editor pre-fills on a document photo. Mirrored in
 * app/lib/document-regions.ts — keep both identical
 * (app/__tests__/shared-lib-parity.test.ts).
 *
 * Default-deny: every text line is covered unless it consists only of
 * words that name the document type ("ПАСПОРТ", "REPUBLIC OF
 * TAJIKISTAN"…). OCR of Tajik names and worn cards is unreliable, so
 * guessing which lines are personal would leak whatever it got wrong;
 * covering everything and letting the person uncover a label is the safe
 * direction. Eyes are covered with one bar per face; the rest of the
 * face stays visible (owner decision), so "text" OCR finds inside the
 * portrait — mouth, ears, hair read as glyphs — is not covered.
 */
export interface DetectedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedText extends DetectedRect {
  text: string;
}

export interface SuggestedRegion extends DetectedRect {
  rotation: number;
}

// Upper-case, letters only. Tajik letters are folded to their Russian
// look-alikes because OCR without a Tajik model reads them that way.
const DOCUMENT_TYPE_WORDS = new Set([
  "ПАСПОРТ", "PASSPORT", "PASSEPORT", "ШИНОСНОМА",
  "РЕСПУБЛИКА", "РЕСПУБЛИКАИ", "ЧУМХУРИИ", "ЧУМХУРИ", "REPUBLIC", "OF",
  "ТОЧИКИСТОН", "ТАДЖИКИСТАН", "TAJIKISTAN", "TOJIKISTON",
  "ID", "CARD", "IDENTITY", "КАРТ", "КАРТА", "КОРТИ", "ШАХСИЯТ", "ШАХОДАТНОМА", "УДОСТОВЕРЕНИЕ",
  "ВОДИТЕЛЬСКОЕ", "ВОДИТЕЛЬСКИЕ", "ПРАВА", "DRIVING", "LICENCE", "LICENSE", "PERMIS", "DE", "CONDUIRE",
  "ДИПЛОМ", "DIPLOMA", "ВИЗА", "VISA", "MASTERCARD", "МИЛЛИ",
]);

const TAJIK_FOLD: Record<string, string> = { Ҷ: "Ч", Ӣ: "И", Ӯ: "У", Ҳ: "Х", Қ: "К", Ғ: "Г", Ё: "Е" };

// Covers a little more than the detected box: OCR boxes hug the glyphs and
// can miss ascenders, descenders and accents.
const TEXT_PAD_X = 0.01;
const TEXT_PAD_Y = 0.006;
const EYE_PAD_X = 0.25; // of the eye-bar width
const EYE_PAD_Y = 0.6; // of the eye-bar height
const MIN_TEXT_HEIGHT = 0.008;
// Portrait around an eye bar, in eye-bar widths: hair above the eyes,
// chin below, ears to the sides.
const FACE_LEFT = 0.4;
const FACE_RIGHT = 1.4;
const FACE_ABOVE = 0.9;
const FACE_BELOW = 1.5;

function words(text: string): string[] {
  return text
    .toUpperCase()
    .replace(/[ҶӢӮҲҚҒЁ]/g, (ch) => TAJIK_FOLD[ch] ?? ch)
    .split(/[^A-ZА-Я]+/)
    .filter(Boolean);
}

/** True when the line only names the document type — the one text left visible. */
export function isDocumentTypeLine(text: string): boolean {
  if (/\d/.test(text) || text.includes("<")) return false;
  const w = words(text);
  return w.length > 0 && w.every((word) => DOCUMENT_TYPE_WORDS.has(word));
}

function clampRect(x: number, y: number, width: number, height: number): SuggestedRegion | null {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(1, x + width);
  const y1 = Math.min(1, y + height);
  if (x1 - x0 <= 0 || y1 - y0 <= 0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rotation: 0 };
}

function insideFace(block: DetectedRect, eyes: DetectedRect[], aspect: number): boolean {
  const cx = block.x + block.width / 2;
  const cy = block.y + block.height / 2;
  return eyes.some((eye) => {
    // Rects are normalized per axis; the face is measured in eye-bar widths.
    const wY = eye.width * aspect;
    return cx >= eye.x - FACE_LEFT * eye.width && cx <= eye.x + FACE_RIGHT * eye.width
      && cy >= eye.y - FACE_ABOVE * wY && cy <= eye.y + FACE_BELOW * wY;
  });
}

/**
 * @param aspect photo width / height — needed to measure the face area.
 */
export function suggestDocumentRegions(textBlocks: DetectedText[], eyes: DetectedRect[], aspect: number): SuggestedRegion[] {
  const regions: SuggestedRegion[] = [];
  for (const block of textBlocks) {
    if (block.height < MIN_TEXT_HEIGHT || isDocumentTypeLine(block.text) || insideFace(block, eyes, aspect)) continue;
    const r = clampRect(
      block.x - TEXT_PAD_X,
      block.y - TEXT_PAD_Y,
      block.width + TEXT_PAD_X * 2,
      block.height + TEXT_PAD_Y * 2,
    );
    if (r) regions.push(r);
  }
  for (const eye of eyes) {
    const padX = eye.width * EYE_PAD_X;
    const padY = eye.height * EYE_PAD_Y;
    const r = clampRect(eye.x - padX, eye.y - padY, eye.width + padX * 2, eye.height + padY * 2);
    if (r) regions.push(r);
  }
  return regions;
}
