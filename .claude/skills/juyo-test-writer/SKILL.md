---
name: juyo-test-writer
description: Write or update Vitest unit and integration tests for JUYO services, hooks, middleware, and lib helpers. Use when adding tests under tests/, when changing lib/services or lib/hooks, or when a bug fix needs a regression test. Not for Playwright E2E — use juyo-e2e-playwright for that.
---

# JUYO test writing

Follow [project.rules.md](../../rules/project.rules.md) for what needs tests.

## Setup

Vitest + jsdom + Testing Library. `tests/setup.ts` stubs the Supabase env vars
so nothing tries to reach a real project. `@/` resolves to the repo root.

`tests/e2e/**` is excluded from Vitest — Playwright owns it.

```
tests/
├── setup.ts
├── middleware.test.ts
├── hooks/use-items.test.ts
├── lib/{utils,image-utils,translations}.test.ts
└── services/{item-service,profile-service}.test.ts
```

**Never add a new test runner or assertion library.** Vitest and
`@testing-library/*` are what exist.

## Mocking Supabase

This is the part that trips people up, and there is already a working solution
in `tests/services/item-service.test.ts`. **Read it and reuse the pattern —
do not invent a second one.**

The Supabase query builder is *thenable*: every builder method returns `this`,
and awaiting the chain resolves it. So the mock chain must:

- return itself from `select`, `order`, `range`, `eq`, `or`, `not`, `limit`,
  `update`, `delete`, `textSearch`
- resolve from terminals `single()` / `maybeSingle()`
- expose a `then` on the chain itself, so `await query` works
- give `insert` its own thenable that also supports `.select().single()`

The client mock also needs `rpc`, `functions.invoke`, and `storage.from`.

Services accept an optional `SupabaseClient`, which is exactly what makes them
testable — pass the mock in rather than stubbing module imports.

## Conventions

- `describe` / `it` / `expect` / `vi` imported explicitly from `vitest`, even
  though `globals: true` is set — match the existing files.
- Test names read as behaviour: `it('returns an empty list when the query has no matches')`.
- Assert on the outcome, and on the arguments passed to Supabase when the point
  of the code *is* the query it builds.
- `any` is allowed in `tests/**` (ESLint exempts it) — use it for mocks, not as
  a way to dodge a real type problem in the code under test.
- Cover the failure path. Most service functions return `{ ok: false, reason,
  status }` or surface a Supabase `error` — test that branch, not just success.

## Regression tests

When fixing a bug, write the test that fails before the fix and passes after.
Name it after the behaviour, not the ticket.

## Verify

```bash
npx vitest run tests/services/item-service.test.ts   # single file
npx vitest run -t "test name"                        # single test
npm run test                                         # everything
```

Report the actual counts. A test that was skipped is not a test that passed.
