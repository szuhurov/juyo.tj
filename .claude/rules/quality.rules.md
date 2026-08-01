# Quality rules

Load when touching UI, translations, accessibility, performance, or caching.

## TypeScript

`strict: true`. Path alias `@/*` maps to the repo root.

- No `any` in `app/`, `lib/`, `components/`. If a Supabase generic genuinely
  cannot be expressed, narrow it locally and comment why.
- `tests/**` is exempt from `no-explicit-any` and `no-unsafe-function-type`
  (see `eslint.config.mjs`) — mocks need the escape hatch. Do not extend that
  exemption elsewhere.
- No `@ts-ignore`. `@ts-expect-error` with a reason, if truly unavoidable.
- `supabase/` is excluded from `tsconfig.json`; those files are checked with
  `deno check`, not `tsc`.

## Server and Client Components

App Router, React 19. Server Components are the default — keep it that way.

- Add `"use client"` only when the file needs state, effects, browser APIs, or
  event handlers. Push the boundary **down** to the smallest leaf component
  rather than marking a whole page.
- Pattern already in use: a Server Component page (`page.tsx`) that fetches and
  renders a `"use client"` sibling (`home-client.tsx`, `item-details-client.tsx`).
  Follow it.
- **There are no Server Actions in this codebase** (zero `"use server"`).
  Mutations go through Route Handlers in `app/api/` called from React Query
  hooks in `lib/hooks/`. Do not introduce a Server Action for a one-off without
  raising it first — it is a new pattern, not an existing one.

## Data fetching

- Client data goes through React Query hooks in `lib/hooks/` (`use-items`,
  `use-profile`, `use-notifications`, `use-admin-*`). Do not call a service
  directly from a component when a hook exists.
- Query keys for admin live in `lib/hooks/admin-query-keys.ts`. Reuse them so
  invalidation keeps working.
- Search goes through the `search_items` Postgres RPC, not `.ilike()` — it
  ranks exact title matches first. Changing search behaviour means changing the
  migration, not adding a client-side filter.

## UI

- Compose from `components/ui/` (shadcn/ui, `new-york` style, Radix). Do not add
  a new base primitive when one exists; do not pull in a second component
  library.
- Tailwind v4. Shared spacing/sizing constants live in `lib/ui-constants.ts`.
- `cn()` from `lib/utils.ts` for conditional classes.
- Admin components mirror the admin routes and live in `components/admin/`.

## Images

`next.config.ts` sets `images.unoptimized: true`. **This is deliberate** — the
Vercel image-optimization quota was exhausted (402 Payment Required) after a
bulk Telegram import, and the comment in that file explains it. Do not "fix"
this. Do not re-enable optimization as a performance improvement.

Still use `next/image` for layout/lazy behaviour, and add any new remote host to
`remotePatterns`.

## Accessibility

- Every interactive element must be reachable and operable by keyboard, with a
  visible focus state.
- Every input needs a real label (`components/ui/label.tsx`), not just a
  placeholder. Icon-only buttons need `aria-label`.
- Errors must be announced in text, not conveyed by colour alone.
- Touch targets: 44px minimum. This is a phone-first product.
- Dialogs and sheets come from Radix — keep focus trapping and Escape working;
  do not hand-roll a modal.

## Responsive and mobile

Most traffic is mobile, and a sibling Expo app (`juyoapp`) is being built to
match this UI. Verify narrow viewports for any layout change, and keep
`components/mobile-navbar.tsx` in mind — content must not sit under it.

## Internationalization

Three locales: `tg` (Tajik, default), `ru`, `en`, all in `lib/translations.ts`
(one large object keyed by locale). Locale lives in a React context plus a
`juyo-locale` cookie. **There is no locale routing** — no `[locale]` segments.

- No hardcoded user-facing strings. Add a key and use `t("key")`.
- **Add the key to all three dictionaries in the same change.** A key present in
  `tg` but missing from `ru`/`en` is a visible bug.
- `tests/lib/translations.test.ts` guards parity — run it after any change here.
- Dates go through `date-fns` with the locale from `lib/date-locales.ts`.

## States

Every data-driven view needs its non-happy paths handled:

- **Loading** — `loading.tsx` exists for most routes; add one for new routes.
- **Empty** — a real message, not a blank region.
- **Error** — `app/error.tsx` is the global fallback; handle local failures too.
- **Permission** — signed-out and non-admin users get a sensible result, not a
  crash. `components/blocked-account-screen.tsx` handles blocked accounts.
- **Offline** — a service worker and `public/offline.html` exist;
  `components/network-status.tsx` surfaces connectivity. Do not assume network.

## Performance

- `next.config.ts` sets `experimental.staleTimes.dynamic: 300`. That is a
  deliberate 5-minute client router cache to stop `loading.tsx` flashing on
  every navigation. Understand the comment before changing it.
- `optimizePackageImports` covers `lucide-react` and `date-fns`. Import icons
  individually; do not re-export barrels of them.
- Do not optimize speculatively. Measure, or leave it alone.

## Comments

Write a comment only when the *why* is non-obvious — a constraint, a past
failure, a deliberate trade-off. `next.config.ts` and `lib/supabase.ts` are the
house examples.

**Language:** existing comments are largely in Tajik. When editing a file with
Tajik comments, write new comments in Tajik. Match whatever the file already
uses. Never translate existing comments as a side effect.
