---
name: juyo-nextjs
description: Build or change JUYO pages, layouts, components, and React Query hooks in the App Router. Use when adding or editing anything under app/(main), app/admin, app/(auth), components/, or lib/hooks/ — new routes, UI changes, forms, loading/error states, or Server/Client Component boundaries.
---

# JUYO Next.js work

Follow [quality.rules.md](../../rules/quality.rules.md) and
[project.rules.md](../../rules/project.rules.md).

## Before writing

Read the nearest existing sibling first. This codebase has strong local
patterns and they are not documented anywhere except in the code.

## Route layout

```
app/(auth)/            Clerk sign-in / sign-up catch-alls
app/(main)/            public site — home, items, profile, qr, scan,
                       notifications, privacy, delete-account
app/admin/             admin panel, gated by ADMIN_USER_IDS
app/api/               Route Handlers (web client + native app)
app/qr/[id]/           public QR landing page (outside (main))
```

Top-level specials: `app/layout.tsx`, `app/error.tsx`, `app/not-found.tsx`,
`app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`.

## The page/client split

The established pattern is a Server Component page that renders a client
sibling:

- `app/(main)/page.tsx` → `home-client.tsx`
- `app/(main)/items/[id]/page.tsx` → `item-details-client.tsx`
- `app/(main)/privacy/page.tsx` → `privacy-content.tsx`

Keep `"use client"` on the leaf that actually needs interactivity, not on the
page. Never let `lib/supabase-admin.ts` reach a client file.

Dynamic route params are a Promise in this Next.js version:

```ts
{ params }: { params: Promise<{ id: string }> }
const { id } = await params;
```

## Data

Client-side data goes through React Query hooks in `lib/hooks/`, which wrap
`lib/services/`. Do not call a service directly from a component when a hook
exists; do not fetch in a `useEffect`.

- Item data: `lib/hooks/use-items.ts`
- Profile: `lib/hooks/use-profile.ts`
- Notifications: `lib/hooks/use-notifications.ts`
- Admin: `lib/hooks/use-admin-*.ts`, keys in `lib/hooks/admin-query-keys.ts`

New admin query? Add its key to `admin-query-keys.ts` so invalidation keeps
working.

## Components

Compose from `components/ui/` (shadcn/ui `new-york`, Radix). Admin UI lives in
`components/admin/` and mirrors the admin routes. Use `cn()` from
`lib/utils.ts`; shared sizing lives in `lib/ui-constants.ts`.

Do not add a new base primitive when one exists, and do not introduce a second
component library.

## Forms

Most forms here are hand-rolled with `useState`. `components/ui/form.tsx` wraps
`react-hook-form`, but **nothing else in the codebase imports it** — treat it as
available, not as the house pattern, and match the file you are editing.

There is **no Zod** in use. Validate manually.

## Every new route needs

- a `loading.tsx` sibling — most routes have one, and `staleTimes` tuning in
  `next.config.ts` assumes it
- all user-facing strings in `lib/translations.ts`, all three locales
- empty / error / signed-out states, not just the happy path
- a check that content does not sit under `components/mobile-navbar.tsx`

## Verify

```bash
npm run lint
npx tsc --noEmit
npx vitest run tests/hooks/   # if you touched a hook
```

View the page at a narrow viewport for any visual change.
