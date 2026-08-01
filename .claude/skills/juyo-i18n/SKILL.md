---
name: juyo-i18n
description: Add or change JUYO user-facing copy across the tg/ru/en dictionaries in lib/translations.ts, and work with the language context, locale cookie, and date locales. Use whenever you introduce a user-visible string, rename a translation key, or find text hardcoded in a component.
---

# JUYO internationalization

Follow [quality.rules.md](../../rules/quality.rules.md).

## Shape

Three locales, one file:

```
lib/translations.ts        translations = { tg: {...}, ru: {...}, en: {...} }
lib/language-context.tsx   LanguageProvider, useLanguage(), type Locale
lib/date-locales.ts        date-fns locale map
```

`tg` (Tajik) is the default and the source language. `ru` and `en` follow.

**There is no locale routing.** No `[locale]` segments, no middleware rewrite.
The locale lives in React context, persisted to `localStorage` under
`juyo-locale` and mirrored into a `juyo-locale` cookie so the server can read
it. Do not add route-based i18n or an i18n library — `i18n-js` is in
`package.json` but the app uses this hand-rolled context.

## Using a string

```tsx
const { t, locale, setLocale } = useLanguage();
<p>{t("items.emptyState")}</p>
<p>{t("items.count", { count: 5 })}</p>
```

`t(key, params?)` interpolates `params` into the string. It is only available in
client components — `useLanguage` is a `"use client"` context.

For server-rendered copy, read the `juyo-locale` cookie and index
`translations[locale]` directly.

## The one rule that matters

**Add every new key to all three dictionaries in the same edit.** A key present
in `tg` but missing from `ru`/`en` renders as a missing string for those users.

The file is ~2000 lines, one locale block after another:

- `tg` starts near line 9
- `ru` near line 704
- `en` near line 1392

Find the sibling key in each block and insert in the same position, so the three
blocks stay structurally parallel and diffable.

`tests/lib/translations.test.ts` guards parity — it is the fastest way to catch
a missed locale.

## Writing the copy

- Tajik first; it is the primary audience and the default.
- Match the tone of neighbouring keys, including sentence case.
- Keep keys namespaced by feature (`items.*`, `profile.*`, `admin.*`), matching
  what is already there. Do not invent a new top-level namespace for one string.
- Do not machine-translate blindly into Tajik — if you are unsure of a term,
  say so and let the user supply it rather than guessing.

## Out of scope for this file

- **Clerk auth screens** are localized via `@clerk/localizations` in
  `lib/clerk-localization.ts` and `components/clerk-localization-provider.tsx`.
- **Dates** go through `date-fns` with the locale from `lib/date-locales.ts` —
  do not format dates with hardcoded month names.
- **SEO title** is read from `translations[locale].seoTitle` by the language
  context, which updates `document.title` on locale change.

## Finding hardcoded text

```bash
rg -n '>[A-ZА-ЯЁ][a-zа-яё ]{3,}<' components app --glob '*.tsx'
```

Cyrillic and Latin both appear in the codebase; a literal in JSX is almost
always a missing translation key.

## Verify

```bash
npx vitest run tests/lib/translations.test.ts
npx tsc --noEmit
```

Then switch the language in the running app and confirm the new string renders
in all three.
