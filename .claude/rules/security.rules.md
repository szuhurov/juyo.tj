# Security rules

Load whenever you touch auth, API routes, uploads, env vars, Supabase clients,
Edge Functions, or anything that renders user-supplied data.

This is a public site holding **lost-and-found reports with contact phone
numbers**. A leak here is a leak of real people's personal data.

## Secrets and environment

- Anything named `NEXT_PUBLIC_*` is **public**. It ships in the client bundle.
  Never put a secret behind that prefix to make it "easier to access".
- Server-only, never importable from a `"use client"` file:
  `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, `OPENAI_API_KEY`,
  `VAPID_PRIVATE_KEY`, `PUSH_INTERNAL_SECRET`, `ADMIN_USER_IDS`,
  `SUPABASE_DB_URL`, `SUPABASE_ACCESS_TOKEN`, `TELEGRAM_*`.
- Never print an env **value** — not in logs, errors, comments, test fixtures,
  commit messages, or screenshots. Names are fine; values never.
- Never read `.env.local` to answer a question about configuration. Read the
  code that consumes the variable instead.
- Do not add new env vars without telling the user they must be set in Vercel
  as well as locally.

## The two Supabase clients

This is the single most important boundary in the codebase.

| Client | File | RLS | Where |
| --- | --- | --- | --- |
| `supabase` (anon) | `lib/supabase.ts` | enforced | client components |
| `createClerkSupabaseClient(token)` | `lib/supabase.ts` | enforced, keyed to the user's Clerk JWT | client components with a signed-in user |
| `supabaseAdmin` (service role) | `lib/supabase-admin.ts` | **bypassed entirely** | Route Handlers / Server Components **only** |

Rules:

- `lib/supabase-admin.ts` must never be imported, transitively, into a file with
  `"use client"`. If it is, the service-role key is in the browser bundle.
- Because `supabaseAdmin` bypasses RLS, **every** query made with it must carry
  its own authorization check in the handler. RLS is not protecting you there.
- Do not "fix" an RLS-denied query by switching to `supabaseAdmin`. That
  converts a permission bug into a security hole. Fix the policy or the query.
- Service layer functions in `lib/services/` accept an optional
  `SupabaseClient`. Pass the *authenticated* client from callers that have one;
  do not default to the admin client for convenience.

## Authorization on every Route Handler

`middleware.ts` protects navigation to `/profile*`, `/items/add`,
`/items/*/edit`, `/admin*`, `/api/admin*`. That is **not sufficient** — it
guards routing, not the handler, and the native app calls these routes directly.

Every handler re-checks for itself, at the top, before any work:

```ts
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

Admin routes use the allowlist and return **404, not 403**, to avoid confirming
the endpoint exists (see `app/api/admin/posts/route.ts`):

```ts
const { userId } = await auth();
if (!isAdminUser(userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

Admin gating is `ADMIN_USER_IDS` (comma-separated Clerk ids) via
`lib/admin-auth.ts`. There is **no roles table** — do not write code that
assumes one.

## Ownership, not just authentication

Being signed in is not permission to touch a row. Any mutation or deletion of
an item, profile, report, or notification must verify the caller owns it (or is
an admin). Check ownership **server-side against the database**, never from a
client-supplied `user_id` field.

`lib/services/item-deletion.ts` is the reference: it returns
`{ ok: false, reason, status }` rather than throwing, and the route maps that
to a response.

Note the two deletion paths — do not conflate them:

- `ItemService.deleteItem` → soft delete / "resolved" flow
- `hardDeleteItem` (`lib/services/item-deletion.ts`) → real deletion, used by
  `app/api/items/[id]/delete`

## Input validation — manual

**There is no Zod in this codebase.** `zod` is in `package.json` and the README
mentions it, but nothing imports it. Do not write code that pretends a
validation layer exists.

Validate explicitly at the server boundary:

- Parse and bound every query param. Existing pattern:
  `Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)))`.
- Never interpolate raw user input into a Supabase `.or()` / `.ilike()` filter.
  Escape it — `app/api/admin/posts/route.ts` does
  `search.slice(0, 100).replace(/[%_\\]/g, "\\$&")`. Copy that.
- Reject unexpected body shapes rather than coercing them.
- Never trust `user_id`, `is_admin`, `role`, `status`, or `moderation_status`
  arriving from a client. Derive them server-side.

## Uploads

Current state, honestly: validation is thin. `accept="image/*"` on an
`<input>` is a **UI hint, not validation**. `app/api/admin/users/[id]/avatar/route.ts`
checks `file.type.startsWith("image/")` — but `file.type` is client-controlled —
and builds the storage path from the user-supplied filename with no size limit.

When you touch an upload path, tighten it rather than copying it:

- Enforce a maximum size before uploading.
- Treat the client MIME type as a hint; prefer an allowlist of concrete types
  (`image/jpeg`, `image/png`, `image/webp`).
- **Never** build a storage path from a user-supplied filename. Derive the
  extension from an allowlist, generate the name yourself.
- Confirm the caller owns the target row before writing to their storage prefix.
- Deleting a row must also clean up its storage objects — see
  `lib/services/item-deletion.ts` and `account-deletion.ts`.

## Personal data

- `app/sitemap.ts` and `app/opengraph-image.tsx` are public and crawlable.
  Never emit phone numbers, emails, or non-public user data there.
- Do not log request bodies, contact details, or Clerk ids in production paths.
  `console.error` in handlers logs `getErrorMessage(err)` only — keep it that way.
- Soft-deleted (`status = 'deleted'`) and archived rows must stay excluded from
  public queries, sitemaps, search results, and notifications.
- Moderation state matters: never surface `moderation_status` pending/rejected
  content on public pages.

## Edge Functions (`supabase/functions/`, Deno)

- `clerk-sync` verifies Clerk webhooks with svix signature headers
  (`svix-id` / `svix-timestamp` / `svix-signature`). Any new webhook receiver
  **must** verify signatures the same way before trusting the payload.
- These functions hold `SUPABASE_SERVICE_ROLE_KEY`. Treat every one of them as
  a privileged endpoint; check the caller.
- They are excluded from ESLint and `tsconfig.json`. Type and lint mistakes here
  are invisible to the app's checks — run `deno lint` / `deno check`.

## Web-facing risks

- **XSS** — avoid `dangerouslySetInnerHTML`. If it is unavoidable, sanitize and
  explain why in a comment.
- **Open redirect** — never redirect to a URL taken from a query param without
  validating it is same-origin.
- **SSRF** — the import scripts and moderation functions fetch remote URLs.
  Never fetch a URL supplied by an end user from server code.
- **Rate limiting** — none exists. Anything newly expensive (OpenAI calls,
  push fan-out, `search_items`) that becomes reachable by anonymous users
  should be flagged to the user as needing a limit.
- `next.config.ts` sets HSTS, `X-Frame-Options: DENY`, `nosniff`, a
  `frame-ancestors 'none'` CSP and a `Permissions-Policy`. Do not weaken these
  to make something work; find another way and raise it.
