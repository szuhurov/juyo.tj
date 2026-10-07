/**
 * Golden privacy cases at the detection level: what a platform detector
 * reports for a JUYO-like photo, and what must happen to it. Every change
 * to lib/privacy-pipeline.ts runs against these (here and in
 * app/__tests__/fixtures/privacy-cases.ts — keep both identical), so an
 * "optimization" cannot silently make JUYO less private.
 *
 * Image-level golden tests (real OCR on rendered documents) live in
 * tests/privacy-golden (npm run test:privacy).
 */
import type { PhotoDetections, Rect, SensitiveKind, TextLine } from '@/lib/privacy-pipeline';

export function line(text: string, y: number, x = 0.1, width = 0.5, height = 0.04, confidence = 0.9): TextLine {
  return { text, x, y, width, height, confidence };
}

export function detections(textLines: TextLine[], extra: Partial<PhotoDetections> = {}): PhotoDetections {
  return {
    width: 1200,
    height: 900,
    textLines,
    textRegions: [],
    faces: [],
    barcodes: [],
    documents: [],
    ran: { text: true, faces: true, barcodes: true, documents: true },
    ...extra,
  };
}

export interface PrivacyCase {
  name: string;
  category: string;
  detections: PhotoDetections;
  expect: {
    decision: 'clean' | 'auto_redacted' | 'review_required' | 'blocked';
    documentLike: boolean;
    covers?: SensitiveKind[];
    mustCover?: Rect[];
    mustStayVisible?: Rect[];
  };
}

const passportNumber = line('A1234567', 0.62, 0.4, 0.25);
const passportName = line('ИВАНОВ', 0.3, 0.4, 0.2);
const passportTitle = line('ШИНОСНОМА / PASSPORT', 0.1, 0.4, 0.4);
const mrz = line('P<TJKIVANOV<<IVAN<<<<<<<<<<<<<<<<<<<<<<<<<<', 0.85, 0.03, 0.94, 0.05);
const passportFace = { x: 0.05, y: 0.2, width: 0.25, height: 0.45, confidence: 0.95, eyes: { x: 0.1, y: 0.33, width: 0.15, height: 0.03 } };

const cardNumber = line('4111 1111 1111 1111', 0.55, 0.08, 0.7, 0.07);
const cardExpiry = line('VALID THRU 08/29', 0.68, 0.08, 0.3);
const cardHolder = line('IVAN IVANOV', 0.8, 0.08, 0.35);
const cardOutline = { x: 0.05, y: 0.1, width: 0.9, height: 0.85, confidence: 0.9, source: 'rectangle' as const };

const qr = { x: 0.6, y: 0.6, width: 0.2, height: 0.26, format: 'qr', payload: 'https://pay.example.com/u/83920' };
const nike = line('NIKE', 0.4, 0.4, 0.2);

export const PRIVACY_CASES: PrivacyCase[] = [
  {
    name: 'passport page — OCR + portrait + MRZ (category Documents)',
    category: 'Documents',
    detections: detections([passportTitle, passportName, passportNumber, mrz], { faces: [passportFace] }),
    expect: {
      decision: 'review_required',
      documentLike: true,
      covers: ['document_number', 'mrz', 'eyes'],
      mustCover: [passportNumber, passportName, mrz, passportFace.eyes],
      mustStayVisible: [passportTitle],
    },
  },
  {
    name: 'passport posted under "Bag" — recognised as a document anyway',
    category: 'Bag',
    detections: detections([passportTitle, passportName, passportNumber, mrz], { faces: [passportFace] }),
    expect: { decision: 'review_required', documentLike: true, mustCover: [passportNumber, passportName, mrz] },
  },
  {
    name: 'ID card where OCR read nothing — shape + portrait + unread text is still a document',
    category: 'Wallet',
    detections: detections([], {
      faces: [passportFace],
      textRegions: [
        { x: 0.4, y: 0.3, width: 0.3, height: 0.04 },
        { x: 0.4, y: 0.4, width: 0.35, height: 0.04 },
        { x: 0.4, y: 0.5, width: 0.25, height: 0.04 },
      ],
      documents: [{ x: 0.02, y: 0.05, width: 0.95, height: 0.9, confidence: 0.9, source: 'segmentation' }],
    }),
    expect: {
      decision: 'review_required',
      documentLike: true,
      mustCover: [{ x: 0.4, y: 0.3, width: 0.3, height: 0.04 }, { x: 0.4, y: 0.5, width: 0.25, height: 0.04 }],
    },
  },
  {
    name: 'bank card under "Wallet" — number, expiry, holder and the whole card covered',
    category: 'Wallet',
    detections: detections([line('DUSHANBE CITY BANK', 0.15, 0.08, 0.5), cardNumber, cardExpiry, cardHolder], { documents: [cardOutline] }),
    expect: { decision: 'review_required', documentLike: true, covers: ['card'], mustCover: [cardNumber, cardExpiry, cardHolder] },
  },
  {
    name: 'bank card without a detected outline (Android/web) — every line covered',
    category: 'Cards',
    detections: detections([cardNumber, cardExpiry, cardHolder]),
    expect: { decision: 'review_required', documentLike: true, mustCover: [cardNumber, cardExpiry, cardHolder] },
  },
  {
    name: 'note with a phone number and e-mail — covered automatically',
    category: 'Other',
    detections: detections([line('Агар ёбед, занг занед', 0.2), line('+992 93 123 45 67', 0.3), line('ivan@mail.ru', 0.4)]),
    expect: {
      decision: 'auto_redacted',
      documentLike: false,
      covers: ['phone', 'email'],
      mustCover: [line('+992 93 123 45 67', 0.3), line('ivan@mail.ru', 0.4)],
      mustStayVisible: [line('Агар ёбед, занг занед', 0.2, 0.1, 0.5, 0.02)],
    },
  },
  {
    name: 'phone box label — IMEI covered, model name visible',
    category: 'Phone',
    detections: detections([line('Galaxy A54 5G', 0.1), line('IMEI 356938035643809', 0.5)]),
    expect: {
      decision: 'auto_redacted',
      documentLike: false,
      mustCover: [line('IMEI 356938035643809', 0.5)],
      mustStayVisible: [line('Galaxy A54 5G', 0.1, 0.1, 0.5, 0.02)],
    },
  },
  {
    name: 'sneaker with a brand name — nothing to hide',
    category: 'Clothing',
    detections: detections([nike]),
    expect: { decision: 'clean', documentLike: false, mustStayVisible: [nike] },
  },
  {
    name: 'QR code on a keyring — covered',
    category: 'Keys',
    detections: detections([], { barcodes: [qr] }),
    expect: { decision: 'auto_redacted', documentLike: false, covers: ['barcode'], mustCover: [qr] },
  },
  {
    name: "JUYO's own QR sticker stays scannable",
    category: 'Keys',
    detections: detections([], { barcodes: [{ ...qr, payload: 'https://juyo.tj/q/abc123' }] }),
    expect: { decision: 'clean', documentLike: false },
  },
  {
    name: 'a person in a bag photo — refused (owner 2026-10-07: no photos of people)',
    category: 'Bag',
    detections: detections([], { faces: [{ x: 0.7, y: 0.1, width: 0.12, height: 0.18, confidence: 0.9, eyes: null }] }),
    expect: { decision: 'blocked', documentLike: false, covers: ['face'], mustCover: [{ x: 0.7, y: 0.1, width: 0.12, height: 0.18 }] },
  },
  {
    name: 'two faces, one small — refused',
    category: 'Other',
    detections: detections([], {
      faces: [
        { x: 0.1, y: 0.1, width: 0.3, height: 0.4, confidence: 0.9, eyes: null },
        { x: 0.8, y: 0.05, width: 0.05, height: 0.07, confidence: 0.7, eyes: null },
      ],
    }),
    expect: { decision: 'blocked', documentLike: false, mustCover: [{ x: 0.8, y: 0.05, width: 0.05, height: 0.07 }] },
  },
  {
    name: 'a selfie posted under Documents — refused, the category does not make a face a document portrait',
    category: 'Documents',
    detections: detections([], { faces: [{ x: 0.25, y: 0.15, width: 0.5, height: 0.6, confidence: 0.95, eyes: { x: 0.33, y: 0.35, width: 0.34, height: 0.06 } }] }),
    expect: { decision: 'blocked', documentLike: true },
  },
  {
    name: 'a full-length photo of a person (small face, no text) — refused',
    category: 'Other',
    detections: detections([], { faces: [{ x: 0.45, y: 0.08, width: 0.08, height: 0.1, confidence: 0.85, eyes: null }] }),
    expect: { decision: 'blocked', documentLike: false },
  },
  {
    name: 'a person holding a passport open — the photo still shows a person, refused',
    category: 'Documents',
    detections: detections([passportTitle, passportName, passportNumber, mrz], {
      faces: [passportFace, { x: 0.55, y: 0.0, width: 0.4, height: 0.35, confidence: 0.9, eyes: null }],
      documents: [{ x: 0.02, y: 0.15, width: 0.5, height: 0.8, confidence: 0.9, source: 'segmentation' }],
    }),
    expect: { decision: 'blocked', documentLike: true },
  },
  {
    name: 'text OCR could not read (blurred label) — covered conservatively',
    category: 'Electronics',
    detections: detections([line('#$%', 0.5, 0.2, 0.3, 0.04, 0.2)], { textRegions: [{ x: 0.2, y: 0.7, width: 0.3, height: 0.03 }] }),
    expect: {
      decision: 'auto_redacted',
      documentLike: false,
      covers: ['unreadable_text'],
      mustCover: [{ x: 0.2, y: 0.5, width: 0.3, height: 0.04 }, { x: 0.2, y: 0.7, width: 0.3, height: 0.03 }],
    },
  },
  {
    name: 'one document word without other evidence — the person is asked to check',
    category: 'Other',
    detections: detections([line('Driving licence', 0.2)]),
    expect: { decision: 'review_required', documentLike: false },
  },
  {
    name: 'rotated/perspective text reported as an axis-aligned box — covered with a margin',
    category: 'Other',
    detections: detections([line('+992 93 555 66 77', 0.5, 0.3, 0.3, 0.12)]),
    expect: { decision: 'auto_redacted', documentLike: false, mustCover: [{ x: 0.3, y: 0.5, width: 0.3, height: 0.12 }] },
  },
  {
    name: 'mask near the edge is clamped to the image',
    category: 'Other',
    detections: detections([line('+992 93 555 66 77', 0.97, 0.7, 0.3, 0.03)]),
    expect: { decision: 'auto_redacted', documentLike: false },
  },
];
