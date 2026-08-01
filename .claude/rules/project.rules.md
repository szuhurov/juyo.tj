# Project rules

Always on. What counts as "done" for a change in this repository.

## Only real commands

Use the scripts that exist in `package.json`. Do not invent scripts, do not
install a tool to make a check possible, do not switch package managers
(`package-lock.json` — this is npm).

```bash
npm run dev            # next dev
npm run build          # next build
npm run lint           # eslint
npx tsc --noEmit       # typecheck (no npm script exists for this)
npm run test           # vitest run
npm run test:watch     # vitest
npm run test:coverage  # vitest run --coverage
npm run test:e2e       # playwright test (starts `npm run dev` itself)
```

Single test file / single test:

```bash
npx vitest run tests/services/item-service.test.ts
npx vitest run -t "test name"
```

There is **no CI** in this repo (no `.github/`, no `vercel.json`). Whatever you
do not run locally, nobody runs.

## Minimum verification per area

Run the narrowest reliable check, not the whole suite by reflex.

| You changed | Run at minimum |
| --- | --- |
| UI component, page, layout | `npm run lint`, `npx tsc --noEmit`; view the page if the change is visual |
| `lib/services/*` | `npx vitest run tests/services/`, `npx tsc --noEmit` |
| `lib/hooks/*` | `npx vitest run tests/hooks/`, `npx tsc --noEmit` |
| Route Handler in `app/api/` | `npx tsc --noEmit`; exercise the route (dev server + curl or the UI); check the native-app contract — see [security.rules.md](security.rules.md) |
| `middleware.ts` | `npx vitest run tests/middleware.test.ts`, plus `npm run test:e2e` if redirect behaviour changed |
| `lib/translations.ts` | `npx vitest run tests/lib/translations.test.ts` — all three dictionaries must stay in sync |
| Supabase migration | Do **not** apply it. Review the SQL, confirm RLS implications, hand it to the user |
| `supabase/functions/**` (Deno) | `deno lint <dir>` and `deno check <file>` — ESLint and `tsc` **skip these** (`eslint.config.mjs`, `tsconfig.json` `exclude`) |
| `scripts/**` | Excluded from ESLint/TS config; run the script's own `--dry-run` where one exists |
| Anything touching auth or admin gating | `npx tsc --noEmit` + a manual signed-out / non-admin check |
| Docs, comments, this directory | Nothing to run |

Before declaring a broad change complete: `npm run lint && npx tsc --noEmit && npm run test`.
`npm run build` when the change could affect bundling, routing, or metadata.

## Tests

Write or update tests when you change:

- anything in `lib/services/` or `lib/hooks/` — these have existing coverage and
  are the layer most worth protecting
- `middleware.ts` route matching or admin gating
- pure helpers in `lib/` (`utils.ts`, `image-utils.ts`, `error-utils.ts`)
- a bug fix — add the regression case that would have caught it

Tests are not required for pure styling, copy changes, or documentation. Say so
explicitly rather than staying silent:

```
Tests: not required — documentation-only change
```

Use the existing frameworks. Vitest + Testing Library for unit/integration,
Playwright for E2E. **Do not add a new test runner or assertion library.**

## Documentation

- Behaviour, architecture, or command changes → update `CLAUDE.md`.
- New or changed AI workflow pieces → update `docs/ai-workflow.md`.
- Import scripts → their own `scripts/*/README.md`.
- Do not update `README.md` from an assumption; it is already stale in places
  (it advertises Zod, which is unused).

## Reporting

State what you ran and what happened. If a check did not run, name it and give
the concrete reason:

```
npm run test — passed (48 tests)
npx tsc --noEmit — passed
npm run test:e2e — skipped: requires a dev server on :3000 and no auth fixtures exist for this flow
```

Never report a task as complete while a required check is unrun and
unexplained. Never describe a failing check as passing.
