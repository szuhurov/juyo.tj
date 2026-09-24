import { describe, it, expect } from 'vitest';
import { CITY_IDS, DEFAULT_CITY, cityLabel } from '@/lib/cities';

// The approved 18-city list plus the trailing "other", in the exact approved
// display order — must stay in sync with items_city_check in
// supabase/migrations/20260919000000_items_city.sql +
// 20260930000006_items_city_other.sql and with app/lib/cities.ts.
const APPROVED_ORDER = [
  'dushanbe', 'khujand', 'bokhtar', 'kulob', 'tursunzoda', 'istaravshan',
  'vahdat', 'hisor', 'panjakent', 'khorugh', 'isfara', 'konibodom',
  'norak', 'roghun', 'guliston', 'buston', 'istiqlol', 'levakant', 'other',
];

describe('CITY_IDS', () => {
  it('has exactly 18 cities plus "other"', () => {
    expect(CITY_IDS).toHaveLength(19);
  });

  it('matches the approved order exactly', () => {
    expect([...CITY_IDS]).toEqual(APPROVED_ORDER);
  });

  it('starts with dushanbe', () => {
    expect(CITY_IDS[0]).toBe('dushanbe');
  });

  it('has no duplicate ids', () => {
    expect(new Set(CITY_IDS).size).toBe(CITY_IDS.length);
  });

  it('contains no district-style entries', () => {
    const forbidden = ['danghara', 'rudaki', 'kulob district', 'kulob_district'];
    for (const f of forbidden) {
      expect(CITY_IDS as readonly string[]).not.toContain(f);
    }
  });
});

describe('DEFAULT_CITY', () => {
  it('is dushanbe', () => {
    expect(DEFAULT_CITY).toBe('dushanbe');
  });

  it('is one of the approved city ids', () => {
    expect(CITY_IDS as readonly string[]).toContain(DEFAULT_CITY);
  });
});

describe('cityLabel', () => {
  it('returns a non-empty label for every city in tg/ru/en', () => {
    for (const locale of ['tg', 'ru', 'en']) {
      for (const id of CITY_IDS) {
        const label = cityLabel(id, locale);
        expect(label).toBeTruthy();
        expect(label).not.toBe(id); // a real translated label, not a raw id fallback
      }
    }
  });

  it('falls back to English for an unknown locale', () => {
    expect(cityLabel('dushanbe', 'fr')).toBe(cityLabel('dushanbe', 'en'));
  });

  it('falls back to the raw id for an unknown city', () => {
    expect(cityLabel('nonexistent-city', 'en')).toBe('nonexistent-city');
  });
});
