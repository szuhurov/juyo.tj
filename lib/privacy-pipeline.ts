/**
 * JUYO's photo privacy contract — the platform-independent half.
 *
 * Every listing photo is checked ON THE DEVICE before it is uploaded:
 *
 *   normalizeImage → detect (documents, text, OCR, faces, barcodes)
 *   → assessPhoto (this file: classify, expand, merge, decide)
 *   → redactImage (solid fill + re-encode, which also drops all metadata)
 *   → findLeaks (this file: detect again on the safe image)
 *   → upload ONLY the safe image
 *
 * The detectors are per platform (lib/photo-privacy.ts: Apple Vision on
 * iOS; Tesseract + android FaceDetector + ZXing on Android; tesseract.js +
 * MediaPipe + zxing-wasm in the browser). They all report what they saw in
 * the shape below, so the privacy decisions are made here, once, the same
 * way on every platform.
 *
 * Policy: a harmless area covered by mistake is acceptable, a passport or
 * card number left visible is not. When the photo looks like a document
 * or card, or a detector could not run, the decision is `review_required`:
 * the person must look at the pre-covered photo in the privacy editor
 * before it can be uploaded. An admin still reviews every listing before
 * it is public.
 *
 * Mirrored in Web/lib/privacy-pipeline.ts and app/lib/privacy-pipeline.ts —
 * the two files must be byte-identical (app/__tests__/shared-lib-parity.test.ts).
 */
import { isDocumentTypeLine, type DetectedRect } from './document-regions';

export type Rect = DetectedRect;

/** A recognized line. `confidence` is 0..1, or −1 when the engine gives none. */
export interface TextLine extends Rect {
  text: string;
  confidence: number;
}

export interface FaceBox extends Rect {
  confidence: number;
  /** Both eyes as one bar; null when the detector gave no eye positions. */
  eyes: Rect | null;
}

export interface BarcodeBox extends Rect {
  format: string;
  payload: string | null;
}

/** A card- or page-shaped area found from the image itself, not from OCR. */
export interface DocumentCandidate extends Rect {
  confidence: number;
  source: 'segmentation' | 'rectangle';
}

/** Everything the platform detectors saw. Rects are normalized (0..1), top-left origin, upright image. */
export interface PhotoDetections {
  /** Pixel size of the analysed (upright) image. */
  width: number;
  height: number;
  textLines: TextLine[];
  /** Text found by a text DETECTOR, whether or not OCR could read it (empty where there is none). */
  textRegions: Rect[];
  faces: FaceBox[];
  barcodes: BarcodeBox[];
  documents: DocumentCandidate[];
  /** Which detectors actually ran. One that did not run could have missed something. */
  ran: { text: boolean; faces: boolean; barcodes: boolean; documents: boolean };
}

export type SensitiveKind =
  | 'card_number' | 'card_security' | 'document_number' | 'mrz' | 'phone' | 'email' | 'url' | 'date'
  | 'name' | 'address' | 'identifier' | 'document_field' | 'unreadable_text'
  | 'barcode' | 'face' | 'eyes' | 'card';

export type Confidence = 'high' | 'medium';

export interface MaskRegion extends Rect {
  kind: SensitiveKind;
  confidence: Confidence;
}

/** 'blocked': the photo may not be uploaded at all, covered or not (see `personPhoto`). */
export type PrivacyDecision = 'clean' | 'auto_redacted' | 'review_required' | 'blocked';

export type ReviewReason =
  /** Looks like an ID, passport, licence or payment card. */
  | 'document'
  /** Some document evidence, not enough to be sure either way. */
  | 'possible_document'
  /** A detector could not run on this device/browser. */
  | 'detector_unavailable';

export interface PrivacyAssessment {
  /** Expanded, merged and clamped — ready to paint. */
  regions: MaskRegion[];
  documentLike: boolean;
  /** Why the photo was judged a document. */
  documentEvidence: string[];
  decision: PrivacyDecision;
  reasons: ReviewReason[];
  /**
   * A face that is not a portrait on a document — a selfie or a photo of a
   * person. Owner decision 2026-10-07: such photos are refused, not covered;
   * JUYO listings show things, not people.
   */
  personPhoto: boolean;
}

/** Categories whose photos are always documents/cards: default-deny on all text and a mandatory review. */
export const DOCUMENT_CATEGORIES = ['Documents', 'Cards'];
/** The plate number is what such a listing is about — plate-shaped identifiers are not forced. */
export const PLATE_CATEGORY = 'LicensePlate';

export interface AssessOptions {
  category: string | null | undefined;
}

// ── text classification ────────────────────────────────────────────────

// Letters as a plain class: Hermes and older browsers are not relied on
// for \p{L} or lookbehind, and \b does not treat Cyrillic as a word.
const L = 'A-Za-zА-Яа-яЁёҶҷӢӣӮӯҲҳҚқҒғ';
/** Any of the alternatives, as whole words. */
function whole(alternatives: string) {
  return new RegExp(`(?:^|[^${L}])(?:${alternatives})(?=$|[^${L}])`, 'i');
}
const ALNUM = new RegExp(`[${L}0-9]`, 'g');
function alnumCount(s: string) {
  return (s.match(ALNUM) ?? []).length;
}

const DOC_KEYWORDS = /(паспорт|шиноснома|passport|passeport|identity|id\s*card|шаҳодатнома|шаходатнома|удостоверение|водительск|driving|driver|licen[cs]e|permis|свидетельство|диплом|аттестат|корти\s*милл|ҷумҳурии|чумхурии|республика|republic|ministry|вазорат|министерств|nationality|миллат|гражданство|insurance|страхов|суғурта|полис)/i;
const DOC_LABELS = whole('насаб|фамилия|surname|ном|имя|given\\s*names?|name|номи\\s*падар|отчество|father|ф\\.?\\s*и\\.?\\s*о|санаи\\s*таваллуд|дата\\s*рождения|date\\s*of\\s*birth|place\\s*of\\s*birth|место\\s*рождения|sex|пол|ҷинс|чинс|date\\s*of\\s*(?:issue|expiry)|дата\\s*(?:выдачи|окончания)|authority|орган\\s*выдав\\S*|мақомот\\S*|макомот\\S*');
/** A label whose value (same or next line) is sensitive, document or not. */
const SENSITIVE_LABELS = whole('passport\\s*(?:no|number|№)|рақами\\s*шиноснома|раками\\s*шиноснома|номер\\s*паспорта|document\\s*(?:no|number)|personal\\s*(?:no|number)|инн|иин|tin|date\\s*of\\s*birth|дата\\s*рождения|санаи\\s*таваллуд|card\\s*(?:no|number)|номер\\s*карты|рақами\\s*корт|cvv2?|cvc2?|csc|pin|пин-?\\s*код|account\\s*(?:no|number)|сч[её]т|ҳисоб|хисоб|iban|swift|бик');
const PERSON_LABELS = /(пардохткунанда|қабулкунанда|кабулкунанда|фиристанда|плательщик|получатель|отправитель|payer|payee|recipient|sender|cardholder|card\s*holder|владелец|мизоҷ|мизоч|клиент|client|customer|пассажир|passenger)/i;
const ADDRESS_WORDS = whole('адрес|суроға|сурога|address|кӯчаи|кучаи|улица|ул\\.|хиёбони|проспект|пр\\.|кв\\.|хонаи|д\\.\\s*\\d+|деҳаи|дехаи|ноҳияи|нохияи|район|мавзеъ|мкр\\S*|микрорайон|street|st\\.|avenue|apt');
const CARD_CONTEXT = whole('visa|master\\s*card|mastercard|maestro|мир|корти\\s*милли|union\\s*pay|unionpay|amex|valid|thru|expires|good\\s*thru|месяц/год|month/year');
const SECURITY_CODE = whole('cvv2?|cvc2?|csc');
const EMAIL = new RegExp(`[${L}0-9._%+-]+@[${L}0-9-]+(\\.[${L}0-9-]+)+`);
const NAME_LIKE = /[A-ZА-ЯЁҶӢӮҲҚҒ][a-zа-яёҷӣӯҳқғ]+/;
const DATE = /(?:^|\D)(?:\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}|(?:19|20)\d{2}[./-]\d{1,2}[./-]\d{1,2})(?=$|\D)/;

/** Cyrillic letters printed like Latin ones on IDs/cards (1:1, keeps offsets). */
const LOOKALIKE: Record<string, string> = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', У: 'Y', І: 'I' };
function latinize(s: string) {
  return s.replace(/[АВЕКМНОРСТХУІ]/g, (ch) => LOOKALIKE[ch]);
}

// OCR reads these as digits inside numbers often enough to matter.
const DIGIT_LIKE: Record<string, string> = { O: '0', D: '0', I: '1', L: '1', '|': '1', Z: '2', S: '5', B: '8', З: '3', Б: '6' };
function digitize(upper: string) {
  // Only inside runs that are already mostly digits, so words stay words.
  return upper.replace(/[\dODILZSBЗБ|](?:[ -]?[\dODILZSBЗБ|]){5,}/g, (run) => {
    const compact = run.replace(/[ -]/g, '');
    return compact.replace(/\D/g, '').length * 3 >= compact.length * 2
      ? run.replace(/[ODILZSBЗБ|]/g, (ch) => DIGIT_LIKE[ch])
      : run;
  });
}

export function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = +digits[digits.length - 1 - i];
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return digits.length > 1 && sum % 10 === 0;
}

interface LineClass {
  kind: SensitiveKind;
  confidence: Confidence;
  /** The value may be on the next line (a label printed above its value). */
  coversNext?: boolean;
}

/**
 * What a single OCR line reveals, or null when it is ordinary text
 * ("NIKE", "Galaxy A54"). `prev` is the line above, for label context.
 * Whole lines are covered, so one finding per line is enough.
 */
export function classifyLine(text: string, prev: string, documentLike: boolean, category: string | null | undefined): LineClass | null {
  const t = text.trim();
  if (!t) return null;
  const lt = digitize(latinize(t.toUpperCase()));
  const ctx = `${prev} ${t}`;

  if (EMAIL.test(t)) return { kind: 'email', confidence: 'high' };
  if (/<{2,}/.test(t) || /^[A-Z0-9<]{25,}$/.test(lt.replace(/\s/g, ''))) return { kind: 'mrz', confidence: 'high' };

  // Masked card numbers ("4400 •••• •••• 1234") still identify the card.
  if (/\d{4,6}(?:[ -]?[X*•]{2,})+[ -]?\d{4}/.test(lt)) return { kind: 'card_number', confidence: 'high' };

  const runs = lt.replace(/[()]/g, '').match(/\+?\d(?:[ .-]?\d){5,}/g) ?? [];
  // IMEIs are 15 Luhn-valid digits too; they are covered, but do not make the photo a card.
  const imei = /IMEI/.test(latinize(ctx.toUpperCase()));
  for (const run of runs) {
    const digits = run.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits) && !(imei && digits.length === 15)) {
      return { kind: 'card_number', confidence: 'high' };
    }
  }

  // Letter+digit identifiers: passports (A1234567), IDs, serials, plates.
  const plate = category === PLATE_CATEGORY;
  if (/(?:^|[^A-Z0-9])[A-Z]{1,3}[ -]?\d{6,10}(?=$|[^A-Z0-9])/.test(lt)) {
    return plate ? { kind: 'identifier', confidence: 'medium' } : { kind: 'document_number', confidence: 'high' };
  }
  if (!plate && /(?:^|[^A-Z0-9])\d{2,4}[ -]?[A-Z]{1,3}[ -]?\d{2,6}(?=$|[^A-Z0-9])/.test(lt) && lt.replace(/\D/g, '').length >= 5) {
    return { kind: 'identifier', confidence: 'medium' };
  }

  if (DATE.test(lt)) return { kind: 'date', confidence: documentLike ? 'high' : 'medium' };
  for (const run of runs) {
    const digits = run.replace(/\D/g, '');
    if (documentLike) return { kind: 'document_number', confidence: 'high' };
    // A plate is "01 1234 AA": its short digit groups are the listing itself.
    if (plate && digits.length < 7) continue;
    // Phones (9 digits in TJ, more with a country code), IMEIs, accounts,
    // serials, ID numbers: none of them belongs on a public photo.
    if (digits.length >= 7 || run.startsWith('+')) return { kind: 'phone', confidence: 'high' };
    return { kind: 'identifier', confidence: 'medium' };
  }

  if (SECURITY_CODE.test(t) || (/(?:^|\D)\d{3,4}(?=$|\D)/.test(lt) && SECURITY_CODE.test(prev))) return { kind: 'card_security', confidence: 'high' };
  if (/(?:^|\D)(?:0[1-9]|1[0-2])\s*\/\s*\d{2}(?=$|\D)/.test(lt) && CARD_CONTEXT.test(ctx)) return { kind: 'card_number', confidence: 'high' };

  if (/(https?:\/\/|www\.)\S+|[a-z0-9-]+\.(tj|ru|com|org|net|me|io|app|link|ly|uz|kz)\/\S*/i.test(t) && !/juyo\.tj/i.test(t)) {
    return { kind: 'url', confidence: 'medium' };
  }

  if (SENSITIVE_LABELS.test(t)) return { kind: 'document_field', confidence: 'high', coversNext: true };
  // A label alone on its line has its value on the next one.
  const labelOnly = (m: RegExpExecArray | null) => !!m && alnumCount(t.slice(m.index + m[0].length)) < 4;
  const person = PERSON_LABELS.exec(t);
  if (person) return { kind: 'name', confidence: 'medium', coversNext: labelOnly(person) };
  const address = ADDRESS_WORDS.exec(t);
  if (address && (/\d/.test(t) || NAME_LIKE.test(t) || labelOnly(address))) {
    return { kind: 'address', confidence: 'medium', coversNext: labelOnly(address) };
  }
  return null;
}

const LETTER = new RegExp(`[${L}]`, 'g');
const WORD4 = new RegExp(`[${L}]{4,}`);

/** No digits, mostly letters, with at least one real word — not a misread number. */
function looksLikeWords(text: string) {
  const compact = text.replace(/\s/g, '');
  if (!compact || /\d/.test(compact)) return false;
  return (compact.match(LETTER) ?? []).length / compact.length >= 0.8 && WORD4.test(text);
}

/** Text evidence that a photo shows a document. Geometry/face evidence is added in assessPhoto. */
function textEvidence(lines: TextLine[]) {
  const found = new Set<string>();
  let score = 0;
  const add = (key: string, points: number) => {
    if (found.has(key)) return;
    found.add(key);
    score += points;
  };
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text;
    if (DOC_KEYWORDS.test(t)) add('keyword', 2);
    if (DOC_LABELS.test(t)) add('labels', 1);
    if (/<{2,}/.test(t)) add('mrz', 3);
    if (DATE.test(t)) add('dates', 1);
    if (classifyLine(t, lines[i - 1]?.text ?? '', false, null)?.kind === 'card_number') add('card_number', 3);
  }
  return { score, found };
}

// ── geometry ───────────────────────────────────────────────────────────

function center(r: Rect) {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

function contains(outer: Rect, p: { x: number; y: number }) {
  return p.x >= outer.x && p.x <= outer.x + outer.width && p.y >= outer.y && p.y <= outer.y + outer.height;
}

function intersection(a: Rect, b: Rect) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export function clampRect<T extends Rect>(r: T): T | null {
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(1, r.x + r.width);
  const y1 = Math.min(1, r.y + r.height);
  if (!(x1 > x0) || !(y1 > y0)) return null;
  return { ...r, x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Safety margin. Detector boxes hug the glyphs/face and can miss accents,
 * descenders, a slightly rotated or perspective-skewed line, or a code's
 * quiet zone. Text margins scale with the line height.
 *
 * @param aspect image width / height (rects are normalized per axis).
 */
export function expandRegion(r: MaskRegion, aspect: number): MaskRegion {
  let padX: number;
  let padY: number;
  switch (r.kind) {
    case 'face':
      padX = r.width * 0.2;
      padY = r.height * 0.2;
      break;
    case 'eyes':
      padX = r.width * 0.25;
      padY = r.height * 0.6;
      break;
    case 'barcode':
    case 'card':
      padX = r.width * 0.08 + 0.01;
      padY = r.height * 0.08 + 0.01 * aspect;
      break;
    default: {
      // Half a line height above/below; ~0.6 line height (in x units) to the sides.
      const grow = r.confidence === 'medium' ? 1.3 : 1;
      padY = Math.max(r.height * 0.35, 0.004) * grow;
      padX = Math.max((r.height / aspect) * 0.6, 0.008) * grow;
    }
  }
  return clampRect({ ...r, x: r.x - padX, y: r.y - padY, width: r.width + padX * 2, height: r.height + padY * 2 }) ?? r;
}

const RANK: Record<Confidence, number> = { medium: 0, high: 1 };

/**
 * Overlapping (or nearly touching) covers become one bounding box — a
 * larger cover is the safe direction, and it leaves no sliver of original
 * pixels between two boxes. Repeats until nothing overlaps.
 */
export function mergeRegions(regions: MaskRegion[], gap = 0.004): MaskRegion[] {
  let out = regions.slice();
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        // Eye bars stay separate so the rest of a document portrait stays visible (owner decision).
        if ((a.kind === 'eyes') !== (b.kind === 'eyes')) continue;
        const grown = { x: a.x - gap, y: a.y - gap, width: a.width + gap * 2, height: a.height + gap * 2 };
        if (intersection(grown, b) <= 0) continue;
        const x0 = Math.min(a.x, b.x);
        const y0 = Math.min(a.y, b.y);
        const x1 = Math.max(a.x + a.width, b.x + b.width);
        const y1 = Math.max(a.y + a.height, b.y + b.height);
        // The stronger finding names the cover; on a tie the larger one (a whole card over its number).
        const keep = RANK[a.confidence] !== RANK[b.confidence]
          ? (RANK[a.confidence] > RANK[b.confidence] ? a : b)
          : (a.width * a.height >= b.width * b.height ? a : b);
        out = out.filter((_, k) => k !== i && k !== j);
        out.push({ ...keep, x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
        changed = true;
        break outer;
      }
    }
  }
  return out;
}

function isJuyoCode(b: BarcodeBox) {
  // JUYO's own QR stickers exist to be scanned by a finder.
  return !!b.payload && /^https?:\/\/(www\.)?juyo\.tj(\/|$)/i.test(b.payload.trim());
}

// ── the decision ──────────────────────────────────────────────────────

const MIN_TEXT_HEIGHT = 0.006;

/** Findings before margins and merging, plus the document judgement. */
function collect(d: PhotoDetections, opts: AssessOptions) {
  const aspect = d.width > 0 && d.height > 0 ? d.width / d.height : 1;
  const inFace = (r: Rect) => d.faces.some((f) => contains(f, center(r)));
  // Text "read" inside a face (hair, mouth, ears) is not text.
  const lines = d.textLines
    .filter((l) => l.height >= MIN_TEXT_HEIGHT && l.width > 0 && !inFace(l))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const regionsOnly = d.textRegions.filter((r) => r.height >= MIN_TEXT_HEIGHT && !inFace(r));

  // ── is this a document / card? Not from OCR alone. ──
  const { score: textScore, found } = textEvidence(lines);
  let score = textScore;
  const evidence = [...found];
  const textBoxes: Rect[] = [...lines, ...regionsOnly];
  const shapes = d.documents.filter((doc) => {
    const w = doc.width * aspect;
    const ratio = Math.max(w, doc.height) / Math.max(1e-6, Math.min(w, doc.height));
    const inside = textBoxes.filter((b) => contains(doc, center(b))).length;
    // ID-1 cards are 1.586:1, passport pages ~1.42:1; perspective bends both.
    return doc.confidence >= 0.6 && inside >= 2 && (doc.source === 'segmentation' || (ratio >= 1.2 && ratio <= 1.9));
  });
  if (shapes.length > 0) {
    score += 2;
    evidence.push('shape');
  }
  // A portrait beside several fields is how IDs, passports and licences look.
  if (d.faces.some((f) => f.width * f.height < 0.25) && textBoxes.length >= 3) {
    score += 2;
    evidence.push('portrait_with_text');
  }
  if (textBoxes.length >= 8 && shapes.length > 0) {
    score += 1;
    evidence.push('dense_fields');
  }
  const forced = !!opts.category && DOCUMENT_CATEGORIES.includes(opts.category);
  if (forced) evidence.push('category');
  const documentLike = forced || score >= 3;
  const possibleDocument = !documentLike && score >= 2;

  // Each face on its own: a document portrait sits inside the document's
  // outline (when the platform finds one) or, without an outline, is small
  // with document fields beside it. Never decided by the chosen category —
  // a selfie posted under "Documents" is still a photo of a person — and a
  // document elsewhere in the photo does not excuse a face next to it.
  const textBeside = (f: FaceBox) => textBoxes.filter((b) => {
    const c = center(b);
    if (contains(f, c)) return false;
    const gap = c.x < f.x ? f.x - (b.x + b.width) : b.x - (f.x + f.width);
    return c.y >= f.y && c.y <= f.y + f.height * 1.2 && gap < f.width * 1.5;
  }).length;
  const onDocument = (f: FaceBox) => shapes.length > 0
    ? shapes.some((doc) => contains(doc, center(f)))
    : f.width * f.height < 0.25 && (score >= 3 || textBoxes.length >= 3) && textBeside(f) >= 2;
  const personPhoto = d.faces.some((f) => !onDocument(f));

  // ── what to cover ──
  const raw: MaskRegion[] = [];
  const push = (r: Rect, kind: SensitiveKind, confidence: Confidence) => {
    const c = clampRect<MaskRegion>({ x: r.x, y: r.y, width: r.width, height: r.height, kind, confidence });
    if (c) raw.push(c);
  };

  let carry: LineClass | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cls = classifyLine(line.text, lines[i - 1]?.text ?? '', documentLike, opts.category);
    const alnum = alnumCount(line.text);
    if (cls) {
      push(line, cls.kind, cls.confidence);
    } else if (carry && alnum >= 2) {
      push(line, carry.kind === 'document_field' ? 'name' : carry.kind, carry.confidence);
    } else if (documentLike) {
      // Default-deny: every line on a document is covered unless it only
      // names the document type ("ШИНОСНОМА / PASSPORT").
      if (alnum >= 1 && !isDocumentTypeLine(line.text)) push(line, 'document_field', 'medium');
    } else if (alnum < 2 || (line.confidence >= 0 && line.confidence < 0.45 && !looksLikeWords(line.text))) {
      // Text OCR could not read is text it cannot vouch for — unless it
      // reads as ordinary words (Tajik letters lower the engines'
      // confidence on perfectly harmless titles).
      push(line, 'unreadable_text', 'medium');
    }
    carry = cls?.coversNext ? cls : null;
  }

  // Text a detector found that OCR did not read at all.
  for (const region of regionsOnly) {
    const read = lines.some((l) => intersection(l, region) > 0.5 * region.width * region.height);
    if (!read) push(region, documentLike ? 'document_field' : 'unreadable_text', 'medium');
  }

  // A payment card: cover the whole card when its outline is known.
  if (found.has('card_number')) {
    for (const doc of shapes) push(doc, 'card', 'high');
  }

  for (const face of d.faces) {
    // Owner decision: on a document portrait only the eyes are covered, so
    // the owner can still recognise their document. Any other face is
    // covered whole — JUYO has no listings about people.
    if (documentLike && face.eyes) push(face.eyes, 'eyes', 'high');
    else push(face, 'face', 'high');
  }

  for (const code of d.barcodes) {
    if (!isJuyoCode(code)) push(code, 'barcode', 'high');
  }

  return { raw, aspect, documentLike, possibleDocument, evidence, personPhoto };
}

export function assessPhoto(d: PhotoDetections, opts: AssessOptions): PrivacyAssessment {
  const { raw, aspect, documentLike, possibleDocument, evidence, personPhoto } = collect(d, opts);
  const regions = mergeRegions(raw.map((r) => expandRegion(r, aspect)));

  const reasons: ReviewReason[] = [];
  if (!d.ran.text || !d.ran.faces || !d.ran.barcodes) reasons.push('detector_unavailable');
  if (documentLike) reasons.push('document');
  else if (possibleDocument) reasons.push('possible_document');

  return {
    regions,
    documentLike,
    documentEvidence: evidence,
    decision: personPhoto ? 'blocked' : reasons.length > 0 ? 'review_required' : regions.length > 0 ? 'auto_redacted' : 'clean',
    reasons,
    personPhoto,
  };
}

/** Kinds that stay covered even if the person removes the cover in the editor. */
const ENFORCED: SensitiveKind[] = ['card_number', 'card_security', 'document_number', 'mrz', 'phone', 'email', 'barcode', 'face', 'eyes', 'card'];

/**
 * Safe-image validation: the detectors run again on the image that would
 * be uploaded, and every high-confidence finding whose centre is not under
 * one of `covers` is returned. Only an empty list passes; otherwise the
 * caller covers the leaks and checks once more.
 *
 * `covers` are the areas already painted — a detector may still "find"
 * something under a solid cover (e.g. eye landmarks guessed under an eye
 * bar), which is not a leak.
 */
export function findLeaks(after: PhotoDetections, covers: Rect[], opts: AssessOptions): MaskRegion[] {
  const { raw, aspect } = collect(after, opts);
  const leaks = raw.filter((r) => r.confidence === 'high' && ENFORCED.includes(r.kind) && !covers.some((c) => contains(c, center(r))));
  return mergeRegions(leaks.map((r) => expandRegion(r, aspect)));
}
