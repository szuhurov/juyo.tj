---
name: juyo-clerk-auth
description: Work with JUYO authentication — Clerk sign-in/sign-up, route protection in middleware.ts, admin gating via ADMIN_USER_IDS, the clerk-sync webhook, and passing Clerk tokens to Supabase. Use when changing who can access what, adding a protected route or admin endpoint, or debugging a 401/403/404 or a redirect loop.
---

# JUYO auth

Follow [security.rules.md](../../rules/security.rules.md).

## How it fits together

- **Clerk** owns sign-in/sign-up. Routes: `app/(auth)/sign-in/[[...sign-in]]`,
  `app/(auth)/sign-up/[[...sign-up]]`.
- **`middleware.ts`** protects navigation with `clerkMiddleware`.
- **`profiles` table** in Supabase mirrors Clerk users. The Clerk user id is the
  primary key, stored as `TEXT`. Sync happens through the
  `supabase/functions/clerk-sync` Edge Function, driven by Clerk webhooks.
- **Admin** is an env allowlist, not a role: `lib/admin-auth.ts` checks the
  Clerk `userId` against `ADMIN_USER_IDS`. **There is no roles table** — do not
  write code that assumes one.

## middleware.ts

Protected matchers: `/profile(.*)`, `/items/add`, `/items/(.*)/edit`,
`/admin(.*)`, `/api/admin(.*)`.

Admin matchers (`/admin(.*)`, `/api/admin(.*)`) additionally check
`isAdminUser(userId)` and, when it fails:

- `/api/admin*` → `404` JSON
- `/admin*` → redirect to `/`

Adding a protected route means adding it to `isProtectedRoute` **and** keeping
the handler's own check. Middleware guards navigation; it is not a substitute
for authorization inside the handler.

`tests/middleware.test.ts` covers this — run it after any change here.

## In a Route Handler

```ts
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

Admin routes, mirroring middleware's 404-not-403 choice:

```ts
const { userId } = await auth();
if (!isAdminUser(userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

`await auth()` resolves both a session cookie (web) and a `Bearer` token
(the native Expo app). No branching needed.

Authentication is not authorization: after establishing *who* the caller is,
check that they own the row they are mutating.

## In a Server Component

```ts
import { auth, currentUser } from "@clerk/nextjs/server";
const { userId } = await auth();
```

## In a Client Component

```ts
import { useAuth, useUser } from "@clerk/nextjs";
const { getToken } = useAuth();
```

To read Supabase as the signed-in user, pass the Clerk token so RLS policies
can key off it:

```ts
const token = await getToken();
const client = createClerkSupabaseClient(token);
```

`createClerkSupabaseClient` caches per token — do not build a fresh client per
call, it triggers "multiple GoTrueClient instances" warnings. See the comment in
`lib/supabase.ts`.

## The clerk-sync webhook

`supabase/functions/clerk-sync/index.ts` verifies svix signature headers
(`svix-id`, `svix-timestamp`, `svix-signature`) against `CLERK_WEBHOOK_SECRET`
before trusting the payload, then writes to `profiles` with the service-role
key.

Any new webhook receiver must verify signatures the same way. This function is
Deno — outside ESLint and `tsc`, so check it with `deno lint` / `deno check`.

## Localization

Clerk UI is localized through `@clerk/localizations` via
`components/clerk-localization-provider.tsx` and `lib/clerk-localization.ts`.
Auth-screen copy changes go there, not into `lib/translations.ts`.

## Related UI

`components/blocked-account-screen.tsx` (blocked accounts),
`components/mandatory-phone-modal.tsx` (forces a phone number before posting).
Both are auth-adjacent gates — check them when changing sign-in flow.

## Verify

```bash
npx vitest run tests/middleware.test.ts
npx tsc --noEmit
npm run test:e2e        # if redirect behaviour changed
```

`tests/e2e/smoke.spec.ts` already asserts that `/items/add` and `/profile`
redirect to sign-in when signed out.
