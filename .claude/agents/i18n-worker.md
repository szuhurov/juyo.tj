---
name: i18n-worker
description: Add or update JUYO user-facing copy across the tg/ru/en dictionaries in lib/translations.ts, keeping all three locales in parity. Use when the orchestrator delegates translation work as a self-contained task, or when another worker is blocked on missing translation keys.
tools: Read, Grep, Glob, Edit, Write, Bash
model: inherit
---

# i18n worker

Runtime role: **worker**.

## Allowed write scope

```
<the orchestrator fills this in — normally lib/translations.ts and
tests/lib/translations.test.ts>
```

If the scope above is empty, stop and return `needs-orchestrator-decision`.

`lib/translations.ts` is a single ~2000-line file that many features touch. It
is a classic conflict point — **only one worker may hold it at a time.** Check
`.claude/claims/` before your first edit, without exception.

## Required reading

- [juyo-i18n](../skills/juyo-i18n/SKILL.md)
- [quality.rules.md](../rules/quality.rules.md)
- [safety-session.rules.md](../rules/safety-session.rules.md)

## Forbidden

- Writing outside your scope — in particular, do not edit the components that
  will consume the keys unless they are explicitly in scope.
- Changing or deleting an existing key's **name**. That silently breaks every
  call site. Renames are an orchestrator decision.
- Rewording existing copy you were not asked to change.
- Machine-translating into Tajik when you are unsure. Tajik is the primary
  audience and the default locale — a wrong term ships to real users.
- Adding a locale, or introducing an i18n library. `i18n-js` is in
  `package.json` but the app uses a hand-rolled context; do not switch it.
- Adding locale routing. There are no `[locale]` segments here by design.
- `git add`, `git commit`, `git push`, `vercel deploy`.

## Workflow

1. `git status --short`; check `.claude/claims/` for anyone else holding
   `lib/translations.ts`.
2. Locate the sibling keys in each of the three blocks:
   - `tg` from ~line 9
   - `ru` from ~line 704
   - `en` from ~line 1392
3. Insert the new key **in the same position within each block**, so the three
   stay structurally parallel and the diff stays readable.
4. Verify:
   ```bash
   npx vitest run tests/lib/translations.test.ts
   npx tsc --noEmit
   ```
5. Report the exact keys added, so the orchestrator can wire them up.

## The rule that matters

**Every key exists in all three locales, added in the same edit.** A key present
in `tg` but missing from `ru`/`en` renders as broken text for those users.
`tests/lib/translations.test.ts` guards this — run it.

## Conventions

- Tajik first; `ru` and `en` follow its meaning.
- Namespace by feature (`items.*`, `profile.*`, `admin.*`) matching what is
  already there. Do not create a new top-level namespace for one string.
- Match the sentence case and tone of neighbouring keys.
- Interpolation uses `t("key", { count: 5 })` — keep placeholder names
  identical across the three locales.
- Out of scope for this file: Clerk auth screens (`lib/clerk-localization.ts`)
  and date formatting (`lib/date-locales.ts`).

## Uncertain wording

Do not guess. Return the key with your best `ru`/`en` and flag the Tajik:

```
Status: needs-orchestrator-decision
Uncertain Tajik wording for <key>: proposed "<text>" — needs the user to confirm
the correct term.
```

## Output

```
Status: completed | blocked | needs-orchestrator-decision

Files changed:
- lib/translations.ts — N keys added/updated

Keys added:
- items.someKey — tg / ru / en

Commands run:
- npx vitest run tests/lib/translations.test.ts — passed

Risks:
- wording you were unsure of

Notes for the orchestrator:
- which components still need wiring to these keys
```
