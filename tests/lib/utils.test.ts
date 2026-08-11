import { describe, it, expect } from 'vitest';
import { cn, stripDocumentNumbers } from '@/lib/utils';

describe('cn (className merger)', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('deduplicates conflicting tailwind classes (last wins)', () => {
    const result = cn('p-2', 'p-4');
    expect(result).toBe('p-4');
  });

  it('filters out falsy values', () => {
    expect(cn('foo', false && 'bar', undefined, null, 'baz')).toBe('foo baz');
  });

  it('handles conditional classes', () => {
    const active = true;
    const result = cn('base', active && 'active', !active && 'inactive');
    expect(result).toBe('base active');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('handles array input', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });
});

describe('stripDocumentNumbers', () => {
  // Ин панҷараи охирин пеш аз саҳифаи ОММАВӢ аст — агар AI рақами
  // шиносномаро дар матн монад, ҳамин ҷо бурида мешавад.
  it('removes a bare document number', () => {
    expect(stripDocumentNumbers('Паспорт Алимов рақами 1234567.')).toBe(
      'Паспорт Алимов рақами.',
    );
  });

  it('removes the series letter attached to the number', () => {
    expect(stripDocumentNumbers('Паспорти Алимов Ҷамшед, № A1234567')).toBe(
      'Паспорти Алимов Ҷамшед',
    );
  });

  it('removes a spaced series prefix', () => {
    expect(stripDocumentNumbers('Корти бонкӣ AB 1234567890 Раҳимов')).toBe(
      'Корти бонкӣ Раҳимов',
    );
  });

  it('removes a number glued to the preceding word', () => {
    expect(stripDocumentNumbers('рақами1234567 гум шуд')).toBe('рақами гум шуд');
  });

  it('does not eat letters from the preceding word', () => {
    // Регекс силсиларо (то 2 ҳарф) мегирад — бе муҳофизат "рақами" ба
    // "рақа" мубаддал мешуд.
    expect(stripDocumentNumbers('рақами 1234567')).toBe('рақами');
  });

  it('keeps names, dates and ordinary phone numbers', () => {
    expect(stripDocumentNumbers('Шиносномаи Каримов, 12.05.2003')).toBe(
      'Шиносномаи Каримов, 12.05.2003',
    );
    expect(stripDocumentNumbers('Телефон 900 12 34 56')).toBe(
      'Телефон 900 12 34 56',
    );
    expect(stripDocumentNumbers('iPhone 13 Pro сиёҳ')).toBe('iPhone 13 Pro сиёҳ');
  });

  it('leaves clean text untouched', () => {
    expect(stripDocumentNumbers('Калиди мошин')).toBe('Калиди мошин');
    expect(stripDocumentNumbers('Паспорт')).toBe('Паспорт');
  });
});
