import { describe, expect, it } from 'vitest';
import { isDocumentTypeLine, suggestDocumentRegions } from '@/lib/document-regions';

const line = (text: string, y = 0.5) => ({ text, x: 0.1, y, width: 0.5, height: 0.04 });

describe('isDocumentTypeLine', () => {
  it('keeps document titles visible, in Tajik, Russian and English', () => {
    expect(isDocumentTypeLine('ПАСПОРТ')).toBe(true);
    expect(isDocumentTypeLine('ҶУМҲУРИИ ТОҶИКИСТОН')).toBe(true);
    expect(isDocumentTypeLine('Republic of Tajikistan')).toBe(true);
    expect(isDocumentTypeLine('ШИНОСНОМА / PASSPORT')).toBe(true);
  });

  it('covers anything personal or unknown', () => {
    expect(isDocumentTypeLine('ИВАНОВ')).toBe(false);
    expect(isDocumentTypeLine('A1234567')).toBe(false);
    expect(isDocumentTypeLine('P<TJKIVANOV<<IVAN<<<<<<<<<')).toBe(false);
    expect(isDocumentTypeLine('PASSPORT 12')).toBe(false);
    expect(isDocumentTypeLine('')).toBe(false);
    expect(isDocumentTypeLine('Ϟ¤§')).toBe(false);
  });
});

describe('suggestDocumentRegions', () => {
  it('covers every line except the document title, padded and clamped to the photo', () => {
    const regions = suggestDocumentRegions(
      [line('ПАСПОРТ', 0.05), line('ИВАНОВ ИВАН', 0.3), { text: 'A1234567', x: 0.8, y: 0.97, width: 0.3, height: 0.05 }],
      [],
      1,
    );
    expect(regions).toHaveLength(2);
    expect(regions[0].x).toBeCloseTo(0.09);
    expect(regions[0].width).toBeCloseTo(0.52);
    const last = regions[1];
    expect(last.x + last.width).toBeLessThanOrEqual(1);
    expect(last.y + last.height).toBeLessThanOrEqual(1);
    expect(regions.every((r) => r.rotation === 0)).toBe(true);
  });

  it('adds a padded bar over the eyes', () => {
    const [bar] = suggestDocumentRegions([], [{ x: 0.4, y: 0.3, width: 0.2, height: 0.05 }], 1);
    expect(bar.x).toBeCloseTo(0.35);
    expect(bar.width).toBeCloseTo(0.3);
    expect(bar.y).toBeCloseTo(0.27);
    expect(bar.height).toBeCloseTo(0.11);
  });

  it('ignores slivers too small to be text', () => {
    expect(suggestDocumentRegions([{ text: 'x', x: 0.1, y: 0.1, width: 0.2, height: 0.002 }], [], 1)).toEqual([]);
  });

  it('keeps the face visible: OCR noise inside the portrait is not covered', () => {
    const eyes = [{ x: 0.1, y: 0.3, width: 0.1, height: 0.02 }];
    const mouth = { text: 'ii', x: 0.12, y: 0.38, width: 0.04, height: 0.02 };
    const name = { text: 'ИВАНОВ', x: 0.3, y: 0.3, width: 0.2, height: 0.04 };
    const regions = suggestDocumentRegions([mouth, name], eyes, 1.4);
    expect(regions).toHaveLength(2); // the name and the eye bar
    expect(regions[0].x).toBeCloseTo(0.29);
  });
});
