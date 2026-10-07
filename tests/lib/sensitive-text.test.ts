import { describe, expect, it } from 'vitest';
import { maskSensitiveNumbers, NUMBER_MASK } from '@/lib/sensitive-text';

describe('maskSensitiveNumbers', () => {
  it('masks bank card numbers in every category', () => {
    expect(maskSensitiveNumbers('Корт 4444 5555 6666 7777 ёфт шуд', 'Other')).toBe(`Корт ${NUMBER_MASK} ёфт шуд`);
    expect(maskSensitiveNumbers('card 4444-5555-6666-7777', 'Electronics')).toBe(`card ${NUMBER_MASK}`);
  });

  it('keeps phone numbers, prices and dates outside documents', () => {
    const text = 'Тел +992 93 123 45 67, мукофот 500, 12.05.2026';
    expect(maskSensitiveNumbers(text, 'Electronics')).toBe(text);
  });

  it('masks document numbers of 6+ digits in the Documents category', () => {
    expect(maskSensitiveNumbers('Шиноснома A1234567 ба номи Иванов И.', 'Documents'))
      .toBe(`Шиноснома A${NUMBER_MASK} ба номи Иванов И.`);
    expect(maskSensitiveNumbers('ID 12-34-567890', 'Documents')).toBe(`ID ${NUMBER_MASK}`);
    expect(maskSensitiveNumbers('рақам 400 123 456', 'Documents')).toBe(`рақам ${NUMBER_MASK}`);
  });

  it('keeps short numbers in documents (house, bus, short dates)', () => {
    const text = 'Дар автобуси 8, хонаи 12, соати 10:30';
    expect(maskSensitiveNumbers(text, 'Documents')).toBe(text);
  });
});
