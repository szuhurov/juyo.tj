import { describe, expect, it } from 'vitest';
import {
  assessPhoto,
  classifyLine,
  findLeaks,
  luhn,
  mergeRegions,
  type PhotoDetections,
} from '@/lib/privacy-pipeline';
import { PRIVACY_CASES, detections, line } from './privacy-cases';

describe('classifyLine', () => {
  it.each([
    ['4111 1111 1111 1111', 'card_number'],
    ['4400 •••• •••• 1234', 'card_number'],
    ['VALID THRU 08/29', 'card_number'],
    ['CVV 123', 'card_security'],
    ['P<TJKIVANOV<<IVAN<<<<<<<<<<<<<<<<<<<', 'mrz'],
    ['ivan.ivanov@mail.ru', 'email'],
    ['+992 93 123 45 67', 'phone'],
    ['(93) 123-45-67', 'phone'],
    ['IMEI 356938035643809', 'phone'],
    ['A1234567', 'document_number'],
    ['А1234567', 'document_number'], // Cyrillic А printed like Latin A
    ['Дата рождения', 'document_field'],
    ['Получатель: Иванов И.', 'name'],
    ['ул. Рудаки 45, кв. 12', 'address'],
  ])('%s → %s', (text, kind) => {
    expect(classifyLine(text, '', false, 'Other')?.kind).toBe(kind);
  });

  it.each(['NIKE', 'Galaxy A54 5G', 'Made in China', 'Нарх 500 сомонӣ', 'adidas', 'ПАСПОРТ'])(
    'leaves ordinary text alone: %s',
    (text) => {
      expect(classifyLine(text, '', false, 'Other')).toBeNull();
    },
  );

  it('reads OCR letter/digit confusions inside numbers', () => {
    expect(classifyLine('4111 1111 1111 IIII', '', false, null)?.kind).toBe('card_number');
  });

  it('a date is personal on a document, possibly personal elsewhere', () => {
    expect(classifyLine('12.05.1990', '', true, null)).toEqual({ kind: 'date', confidence: 'high' });
    expect(classifyLine('12.05.1990', '', false, null)).toEqual({ kind: 'date', confidence: 'medium' });
  });

  it('keeps plate numbers visible only in the LicensePlate category', () => {
    expect(classifyLine('01 1234 AA', '', false, 'LicensePlate')).toBeNull();
    expect(classifyLine('1234 AA 01', '', false, 'Other')).not.toBeNull();
  });
});

describe('luhn', () => {
  it('validates card numbers', () => {
    expect(luhn('4111111111111111')).toBe(true);
    expect(luhn('4111111111111112')).toBe(false);
  });
});

describe('mergeRegions', () => {
  it('merges overlapping covers into one box but keeps eye bars apart', () => {
    const merged = mergeRegions([
      { x: 0.1, y: 0.1, width: 0.2, height: 0.05, kind: 'phone', confidence: 'high' },
      { x: 0.25, y: 0.12, width: 0.2, height: 0.05, kind: 'name', confidence: 'medium' },
      { x: 0.3, y: 0.1, width: 0.1, height: 0.02, kind: 'eyes', confidence: 'high' },
    ]);
    expect(merged).toHaveLength(2);
    const text = merged.find((r) => r.kind !== 'eyes')!;
    expect(text.kind).toBe('phone');
    expect(text.x).toBeCloseTo(0.1);
    expect(text.width).toBeCloseTo(0.35);
  });
});

describe('assessPhoto — golden cases', () => {
  it.each(PRIVACY_CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const a = assessPhoto(c.detections, { category: c.category });
    expect(a.decision).toBe(c.expect.decision);
    expect(a.documentLike).toBe(c.expect.documentLike);
    for (const kind of c.expect.covers ?? []) {
      expect(a.regions.map((r) => r.kind)).toContain(kind);
    }
    // Every sensitive box must end up fully inside one cover.
    for (const s of c.expect.mustCover ?? []) {
      const covered = a.regions.some((r) => r.x <= s.x && r.y <= s.y
        && r.x + r.width >= s.x + s.width && r.y + r.height >= s.y + s.height);
      expect({ box: s, covered }).toEqual({ box: s, covered: true });
    }
    for (const s of c.expect.mustStayVisible ?? []) {
      const touched = a.regions.some((r) => r.x < s.x + s.width && r.x + r.width > s.x
        && r.y < s.y + s.height && r.y + r.height > s.y);
      expect({ box: s, touched }).toEqual({ box: s, touched: false });
    }
    for (const r of a.regions) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(1 + 1e-9);
      expect(r.y + r.height).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('asks for review when a detector did not run, even on a plain photo', () => {
    const d: PhotoDetections = { ...detections([]), ran: { text: true, faces: false, barcodes: true, documents: false } };
    expect(assessPhoto(d, { category: 'Bag' })).toMatchObject({ decision: 'review_required', reasons: ['detector_unavailable'] });
  });
});

describe('findLeaks', () => {
  const card = line('4111 1111 1111 1111', 0.5);

  it('flags a card number that is still readable after editing', () => {
    expect(findLeaks(detections([card]), [], { category: 'Other' }).map((l) => l.kind)).toEqual(['card_number']);
  });

  it('ignores what is already under a cover', () => {
    const cover = { x: 0, y: 0.45, width: 1, height: 0.15 };
    expect(findLeaks(detections([card]), [cover], { category: 'Other' })).toEqual([]);
  });

  it('does not enforce harmless or medium findings', () => {
    expect(findLeaks(detections([line('NIKE', 0.2), line('12.05.2024', 0.3)]), [], { category: 'Other' })).toEqual([]);
  });
});
