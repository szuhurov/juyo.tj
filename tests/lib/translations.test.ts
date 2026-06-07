import { describe, it, expect } from 'vitest';
import { translations } from '@/lib/translations';

const LOCALES = ['tg', 'ru', 'en'] as const;

// Keys that must exist in every locale
const REQUIRED_KEYS = [
  'home', 'profile', 'search', 'add', 'cancel', 'delete', 'save',
  'loading', 'error', 'success', 'yes', 'no', 'confirm',
  'qrMyCode', 'lost', 'found', 'reward', 'description', 'date',
  'noInternet', 'backOnline', 'pleaseLogin',
  'addedToSaved', 'removedFromSaved',
  'publishSuccess', 'deleteConfirm',
  'atLeastOneImage', 'enterTitleDesc',
  'noItemsFound',
];

describe('translations completeness', () => {
  for (const locale of LOCALES) {
    it(`[${locale}] has all required top-level keys`, () => {
      const t = translations[locale];
      expect(t, `Locale "${locale}" not found in translations`).toBeDefined();

      for (const key of REQUIRED_KEYS) {
        expect(
          t[key],
          `Missing key "${key}" in locale "${locale}"`
        ).toBeDefined();
      }
    });
  }

  it('tg locale has ai_steps object with all required sub-keys', () => {
    const aiSteps = translations.tg.ai_steps;
    expect(aiSteps).toBeDefined();
    const requiredSubKeys = [
      'scanning_pixels', 'detecting_features', 'checking_safety',
      'brain_started', 'please_wait', 'do_not_exit',
    ];
    for (const key of requiredSubKeys) {
      expect(aiSteps[key], `Missing ai_steps.${key}`).toBeDefined();
    }
  });

  it('tg locale has imageModeration with submitted, pending, rejected', () => {
    const mod = translations.tg.imageModeration;
    expect(mod).toBeDefined();
    expect(mod.submitted).toBeDefined();
    expect(mod.pending).toBeDefined();
    expect(mod.rejected).toBeDefined();
  });

  it('ru locale has imageModeration with submitted, pending, rejected', () => {
    const mod = translations.ru.imageModeration;
    expect(mod).toBeDefined();
    expect(mod.submitted).toBeDefined();
    expect(mod.pending).toBeDefined();
    expect(mod.rejected).toBeDefined();
  });

  it('tg locale has categories for all 6 CATEGORIES', () => {
    const cats = translations.tg.categories;
    expect(cats).toBeDefined();
    const expectedNames = ['Electronics', 'Documents', 'Keys', 'Clothing', 'Pets', 'Other'];
    for (const name of expectedNames) {
      expect(cats[name], `Missing category translation for "${name}"`).toBeDefined();
    }
  });

  it('no translation value is an empty string for required keys', () => {
    for (const locale of LOCALES) {
      const t = translations[locale];
      if (!t) continue;
      for (const key of REQUIRED_KEYS) {
        if (t[key] !== undefined) {
          expect(
            t[key].length,
            `Key "${key}" in locale "${locale}" is empty string`
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('translations en locale', () => {
  it('en locale exists', () => {
    expect(translations.en).toBeDefined();
  });

  it('en locale has basic navigation keys', () => {
    const en = translations.en;
    if (!en) return;
    expect(en.home).toBeDefined();
    expect(en.profile).toBeDefined();
  });
});
