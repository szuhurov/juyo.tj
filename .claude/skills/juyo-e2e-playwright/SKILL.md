---
name: juyo-e2e-playwright
description: Write and run Playwright end-to-end tests for JUYO under tests/e2e. Use when verifying a full user flow in a real browser — navigation, redirects for signed-out users, 404 handling — or when asked to run npm run test:e2e. Not for unit tests; use juyo-test-writer for those.
---

# JUYO E2E tests

Follow [project.rules.md](../../rules/project.rules.md).

## Setup

`playwright.config.ts`:

- `testDir: './tests/e2e'` — Vitest excludes this directory, no overlap
- `baseURL`: `PLAYWRIGHT_BASE_URL` or `http://localhost:3000`
- **`webServer` starts `npm run dev` automatically** and reuses an existing
  server outside CI — do not start a dev server yourself first, and do not add
  one to the test file
- one project: `chromium` / Desktop Chrome
- `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`

```bash
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:headed
npx playwright test tests/e2e/smoke.spec.ts
npx playwright test -g "home page loads"
```

First run on a machine may need `npx playwright install chromium`. That
downloads browsers — ask before running it.

## What exists

`tests/e2e/smoke.spec.ts`, unauthenticated only:

- home page loads, has a `header` and a `main`
- unknown route returns 404 and renders 404 copy
- `/items/add` and `/profile` redirect to sign-in when signed out

Read it before adding tests; match its style.

## No auth fixtures

**There is no signed-in fixture, no stored auth state, no Clerk test user.**
Everything today is anonymous.

Do not fake a Clerk session by setting cookies — it will not work. If a flow
needs a signed-in user, either:

- test the signed-out half (the redirect), or
- tell the user that a Clerk test account plus a `storageState` setup project is
  needed, and let them decide.

Do not invent credentials or read them from `.env.local`.

## Conventions

- Group with `test.describe`, name by the behaviour being asserted.
- Use `baseURL`-relative paths: `await page.goto('/items/add')`.
- Prefer role/text locators over CSS selectors.
- Copy is localized and the default locale is Tajik — assert with a regex
  covering the languages that can appear:
  `toContainText(/404|Ёфт нашуд|not found/i)`.
- Redirects to Clerk leave the origin — `await page.waitForURL(/sign.in|clerk\.com/i)`
  with an explicit timeout, as the existing tests do.
- Never assert against production data. The dev server points at the real
  Supabase project, so item content is not stable — assert on structure and
  navigation, not on specific listings.

## When to write one

E2E is slow. Reserve it for flows that unit tests cannot cover: routing,
middleware redirects, auth gating, 404/error boundaries. Business logic belongs
in Vitest against `lib/services/`.

Run E2E when you change `middleware.ts`, route structure, or `app/error.tsx` /
`app/not-found.tsx`.

## Verify

```bash
npm run test:e2e
```

Report actual pass/fail counts. If the run needed a browser download or a
running server you could not provide, say so and mark it skipped — do not
report an unrun suite as passing.
