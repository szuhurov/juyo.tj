# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

JUYO.TJ — a Next.js web platform for reporting/searching **lost and found items** in Tajikistan (Lost/Found listings with categories, images, moderation, QR codes, comments-style verification, admin panel). Source comments and docs are written in Tajik; keep that convention when editing existing files (see "Language" below).

There is a sibling Expo/React Native app (`juyoapp`, separate repo, not in this working directory) being built to parity with this web app. It has no backend of its own — it calls this app's `/api/*` routes directly with a Clerk Bearer token instead of a session cookie. When changing an API route under `app/api/`, check whether it's one of the routes the native app depends on (look for comments like "Native низ ҳамин route-ро ... занг мезанад") and keep the contract backward compatible.

## AI workflow

This file is the entry point. The details live under `.claude/` — see [docs/ai-workflow.md](docs/ai-workflow.md) for the full picture.

**Rules** (`.claude/rules/`) — always read the first three:

| File | Covers |
| --- | --- |
| `safety-session.rules.md` | No rollback, claim checks, preserving other sessions' work |
| `project.rules.md` | When tests are required, minimum verification per area |
| `git-workflow.rules.md` | Commit format, staging discipline, no commit unless asked |
| `security.rules.md` | Auth, secrets, the service-role client, uploads, personal data |
| `quality.rules.md` | TypeScript, Server/Client boundary, a11y, i18n parity, performance |
| `parallel-work.rules.md` | Delegation, worker scoping, reviewer read-only guarantees |

**Skills** (`.claude/skills/`) — auto-discovered, no install step. `juyo-nextjs`, `juyo-api-contract`, `juyo-test-writer`, `juyo-git-workflow`, `juyo-clerk-auth`, `juyo-supabase-data`, `juyo-supabase-storage`, `juyo-i18n`, `juyo-e2e-playwright`, `juyo-seo-pwa`.

**Subagents** (`.claude/agents/`) — the main session is always the orchestrator; these are delegable roles. Reviewers (`code-reviewer`, `security-reviewer`, `api-contract-reviewer`, `qa-verifier`) are read-only by their `tools:` frontmatter. Write-workers (`nextjs-worker`, `server-worker`, `test-worker`, `data-storage-worker`, `e2e-worker`, `i18n-worker`) require an explicit, non-overlapping write scope from the orchestrator.

**Claims** (`.claude/claims/`, git-ignored) — before writing files, run `git status --short` and check for another session's `status: active` claim covering the same paths. A SessionStart hook prints active claims. Never edit or close someone else's claim.

**Do not assume, verify.** Several plausible technologies are *not* used here: Zod is installed but unused, there are no Server Actions, no CI, and no locale routing. See `.claude/rules/README.md`.

## Commands

```bash
npm run dev              # Next.js dev server (localhost:3000)
npm run build             # Production build
npm run lint               # ESLint

npm run test               # Vitest — run once
npm run test:watch         # Vitest — watch mode
npm run test:ui            # Vitest UI
npm run test:coverage      # Vitest with coverage
npx vitest run tests/services/item-service.test.ts   # single test file
npx vitest run -t "test name"                          # single test by name

npm run test:e2e           # Playwright e2e (spins up `npm run dev` automatically)
npm run test:e2e:ui
npm run test:e2e:headed
```

Data-import scripts (each takes `--dry-run` where noted; all load `.env.local`):

```bash
npm run somon:import[:dry]      # somon.tj scraper import
npm run somon:scheduler
npm run telegram:import[:dry]   # Telegram channel import (scripts/telegram-import/)
npm run telegram:scheduler
npm run telegram:login          # generates TELEGRAM_SESSION

npm run embeddings:rebuild[:dry]  # rebuilds every item_images.embedding via the
                                  # generate-embedding edge function (costs OpenAI
                                  # calls). Needed whenever the embedding model or
                                  # the forensic prompt changes — old vectors stop
                                  # being comparable to new query vectors.
                                  # `--missing` limits it to images with no vector.
```

`scripts/**` and edge functions under `supabase/functions/**` are excluded from the app's ESLint/TS config — they run under `tsx`/Deno respectively, not the Next.js bundler.

## Deploying

**`git push` to `main` does NOT auto-deploy.** Vercel auto-deploy is disabled for this project — a push only updates the git history. To ship, run `vercel deploy --prod` manually, and only when explicitly asked to deploy.

Per user preference (as of 2026-07-15): verify changes locally (lint/build/tests) but do not commit, push, or deploy unless explicitly told to.

## Architecture

**Stack:** Next.js (App Router, React 19) + TypeScript + Tailwind v4 + Supabase (Postgres/Storage/Edge Functions) + Clerk (auth) + React Query.

### Auth model

- Clerk handles sign-in/sign-up; a Supabase Edge Function (`supabase/functions/clerk-sync`) syncs Clerk webhook events into the `profiles` table (Clerk user id is the PK, stored as TEXT).
- `middleware.ts` protects `/profile*`, `/items/add`, `/items/*/edit`, and everything under `/admin` and `/api/admin`. Admin gating is a simple allowlist: `lib/admin-auth.ts` checks the Clerk `userId` against `ADMIN_USER_IDS` (comma-separated env var) — there is no roles table.
- Two Supabase clients, never mix them up:
  - `lib/supabase.ts` — anon-key client for client components; `createClerkSupabaseClient(token)` attaches the user's Clerk JWT as a Bearer header so Postgres RLS policies can key off it (cached per-token, since a fresh client per call spams "multiple GoTrueClient instances" warnings).
  - `lib/supabase-admin.ts` — service-role client (`supabaseAdmin`) that bypasses RLS. **Server-only** (Route Handlers / Server Components) — never import it into a `"use client"` file.
- API routes that need to run as admin do their own `auth()` + `isAdminUser()` check at the top of the handler (see `app/api/admin/posts/route.ts`) — middleware only blocks navigation, route handlers still self-check.

### Data layer

- `lib/services/*.ts` — the query/mutation layer (`item-service.ts`, `profile-service.ts`, `item-deletion.ts`, `account-deletion.ts`, `admin-service.ts`, `stats-service.ts`). Functions optionally accept a `SupabaseClient` param so callers can pass an authenticated client instead of the default anon one.
- `lib/hooks/use-*.ts` — React Query hooks wrapping the services (`use-items`, `use-profile`, `use-notifications`, `use-admin-*`, `use-web-push`, etc.).
- Search (`ItemService.getItems`) goes through the `search_items` Postgres RPC (see `supabase/migrations/`), not a plain `.ilike()` query — it ranks exact-title matches first. When touching search behavior, check the matching migration rather than assuming a simple filter.
- **Visual search** is a pgvector pipeline with a strict symmetry requirement: `generate-embedding` (indexing) and `visual-search` (querying) must use the *same* embedding model, the same `dimensions`, and the same forensic prompt — both currently `text-embedding-3-large` @ 1536 dims with `gpt-4o-mini` vision. If either side changes, every stored vector must be rebuilt (`npm run embeddings:rebuild`) or search silently returns wrong items rather than erroring. `generate-embedding` embeds *every* image of an item; `match_item_images` returns only the best-matching image per item so one listing can't fill the results.
- Items support soft-delete (`status` column) and a separate hard-delete path (`lib/services/item-deletion.ts`, used by `app/api/items/[id]/delete`) distinct from `ItemService.deleteItem`'s soft-delete-as-"resolved" flow — don't conflate the two.
- Migrations live in `supabase/migrations/` (timestamp-prefixed SQL, applied via Supabase CLI/dashboard — no ORM). `schema.sql` and `rls_policies.sql` at the repo root are older reference snapshots, not the source of truth for current schema — treat `supabase/migrations/` as authoritative.

### App structure

- `app/(auth)/` — Clerk sign-in/sign-up catch-all routes.
- `app/(main)/` — public site: home/search, item detail + edit, profile, QR pages, notifications, scan, privacy, delete-account.
- `app/admin/` + `app/api/admin/` — internal admin panel (posts, users, reports, deletion requests, stats, settings) gated by `ADMIN_USER_IDS`.
- `app/api/` — Route Handlers used both by the web client and by the native app's Bearer-token calls.
- `components/ui/` — shadcn/ui primitives (`new-york` style, Radix-based, path aliases configured in `components.json`). Prefer composing from these over adding new base primitives.
- `components/admin/` — admin-only components, mirrors the `app/admin/` route groups.

### Edge Functions (`supabase/functions/`, Deno)

`clerk-sync`, `image-moderation`, `text-moderation`, `ai-brain`, `generate-embedding`, `visual-search`, `admin-notify`, `notify-category-post`, `notify-pending-review`, `notify-qr-scan`, `cleanup-expired-posts`. Moderation uses OpenAI; these run on Deno and are excluded from the Next.js TS/ESLint config, so they must be checked with `deno lint`/`deno check` separately if modified.

### i18n

Three locales: `tg` (Tajik, default), `ru`, `en` — see `lib/translations.ts` and `lib/language-context.tsx`. Locale is persisted to `localStorage` and mirrored into a `juyo-locale` cookie so the server can read it too.

### Language / comment convention

Existing code comments and some UI strings are written in Tajik. When editing a file that already has Tajik comments, keep new comments in Tajik for consistency; when adding comments to English-commented files, match the existing file. Follow the project-wide default of writing comments only when the *why* is non-obvious (there's plenty of precedent for this in the codebase — see `next.config.ts`'s `unoptimized: true` comment explaining a past Vercel image-optimization payment error, or `lib/supabase.ts`'s client-caching comment).

## Environment variables

Required in `.env.local` (see `lib/supabase.ts`, `lib/supabase-admin.ts`, `lib/admin-auth.ts` for where each is read): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `ADMIN_USER_IDS`, `OPENAI_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_INTERNAL_SECRET`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`.
