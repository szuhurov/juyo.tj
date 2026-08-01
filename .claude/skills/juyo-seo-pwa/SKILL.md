---
name: juyo-seo-pwa
description: Work on JUYO's SEO and PWA surface — metadata, sitemap.ts, robots.ts, opengraph-image.tsx, public/manifest.json, the service worker in public/sw.js, offline.html, and web push. Use when changing page titles or social previews, adding routes that should (or must not) be indexed, or touching install/offline/push behaviour.
---

# JUYO SEO and PWA

Follow [security.rules.md](../../rules/security.rules.md) — the sitemap and OG
image are public and crawlable, so personal data must never reach them.

## Files

```
app/layout.tsx              root metadata
app/sitemap.ts              dynamic sitemap from Supabase
app/robots.ts               robots.txt
app/opengraph-image.tsx     generated social preview
public/manifest.json        PWA manifest
public/sw.js                service worker
public/offline.html         offline fallback
public/icon-192.png, icon-512.png, apple-touch-icon.png, badge-96.png
public/.well-known/         web-app-origin-association
components/network-status.tsx
lib/hooks/use-web-push.ts
```

## Sitemap

`app/sitemap.ts` builds from `https://juyo.tj`, then queries Supabase with the
**anon key** for items that are:

```ts
.eq('moderation_status', 'approved')
.or('is_resolved.eq.false,is_resolved.is.null')
```

Constraints when editing it:

- It runs at build time too. It already falls back to static routes when the
  Supabase env vars are missing — keep that guard, or builds break.
- Never widen the filter to include pending, rejected, resolved, or
  soft-deleted (`status = 'deleted'`) items.
- Never emit phone numbers, emails, or any profile data. Item URLs only.
- Use the anon client here, never `supabaseAdmin` — RLS is a second safety net
  for exactly this file.

## robots.ts

Currently disallows `/profile`, `/sign-in`, `/sign-up`, `/qr/`.

`/qr/` is disallowed on purpose: those are per-item scan landing pages tied to a
physical sticker, not content to index. Any new route exposing user-specific or
token-bearing URLs must be added to `disallow` in the same change.

## Metadata

Root metadata lives in `app/layout.tsx`. Per-route metadata goes in the route's
`page.tsx` via `export const metadata` or `generateMetadata`.

Page titles are locale-aware: the language context reads
`translations[locale].seoTitle` and updates `document.title` on locale change
(`lib/language-context.tsx`). Do not hardcode a title that fights it.

`app/opengraph-image.tsx` generates the social preview. It is public — no user
data in it.

## PWA

- `public/manifest.json` — icons, name, theme. Icon changes need the matching
  files in `public/`.
- `public/sw.js` — served with `Cache-Control: max-age=0, must-revalidate` and
  `Service-Worker-Allowed: /` via `next.config.ts` headers. **Do not add
  caching headers to `sw.js`**; a cached service worker cannot be updated.
- `public/offline.html` is the offline fallback.
  `components/network-status.tsx` surfaces connectivity in the UI.
- Test PWA changes in a real browser with DevTools → Application. A stale
  service worker is the usual cause of "my change didn't apply" — unregister
  and hard-reload before concluding anything.

## Web push

`lib/hooks/use-web-push.ts` plus `app/api/push/send/route.ts`, using `web-push`
with VAPID keys. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is public by design;
`VAPID_PRIVATE_KEY` and `PUSH_INTERNAL_SECRET` are server-only.

Push tokens are stored via a Postgres RPC (`register_push_token`, see
`supabase/migrations/`). Several Edge Functions fan out notifications
(`notify-category-post`, `notify-qr-scan`, `notify-pending-review`,
`admin-notify`).

Notification copy is user-facing — it belongs in `lib/translations.ts`, all
three locales.

## Security headers

`next.config.ts` sets HSTS, `X-Frame-Options: DENY`, `nosniff`,
`Referrer-Policy`, a `Permissions-Policy` (camera allowed for the QR scanner)
and a CSP with `frame-ancestors 'none'` and `object-src 'none'`.

Do not weaken these to make an embed or a third-party script work. Raise it
instead.

## Verify

```bash
npm run build     # sitemap and OG image are generated during build
npx tsc --noEmit
```

Then check `/sitemap.xml` and `/robots.txt` against the running server, and
confirm no personal data appears in either.
