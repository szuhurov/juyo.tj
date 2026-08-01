---
name: juyo-api-contract
description: Design or change Route Handlers under app/api/ — request shapes, status codes, error bodies, pagination, dates, and keeping the contract backward compatible for the sibling Expo app. Use when adding, editing, or reviewing anything in app/api/, or when a client stops matching what a route returns.
---

# JUYO API contract

Follow [security.rules.md](../../rules/security.rules.md) — authorization is
not optional and is not handled by middleware alone.

## Two consumers, one contract

Every route under `app/api/` is called by the web client **and** potentially by
the sibling Expo app (`juyoapp`), which has no backend of its own and calls
these routes with a Clerk Bearer token instead of a session cookie.

Routes the native app depends on carry a Tajik comment saying so — look for
`Native низ ҳамин route-ро ... занг мезанад`. Examples:
`app/api/items/[id]/delete/route.ts`, `app/api/account/change-email/route.ts`.

**Changing those routes is a breaking change for an app you cannot redeploy in
this repo.** Additive changes only:

- adding a response field — safe
- adding an optional request field — safe
- renaming or removing a field, tightening a type, changing a status code —
  breaking; raise it with the user before doing it

`await auth()` works for both cookie and Bearer callers, so no branching is
needed for auth itself.

## Handler shape

```ts
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    // ...
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/items/[id]/delete:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

Non-negotiable pieces:

- auth check **first**, before parsing anything
- `try/catch` around the body, `console.error` with the method + path prefix
- errors logged through `getErrorMessage()` from `lib/error-utils.ts`
- the catch-all response is `{ error: "Internal error" }`, status 500 — never
  leak the underlying error text to the client

## Status codes as used here

| Code | When |
| --- | --- |
| 200 | success |
| 400 | malformed or missing input |
| 401 | not signed in |
| 403 | signed in, not allowed (non-admin routes) |
| **404** | **admin routes, when the caller is not an admin** — deliberate, hides the endpoint |
| 409 | conflict (already exists / already resolved) |
| 500 | unexpected |

Admin routes return 404 rather than 403. Keep that.

## Response bodies

- Success: a named object — `{ posts, total, page, pageSize }`, `{ profile }`,
  `{ ok: true }`. Not a bare array, not a bare boolean.
- Error: `{ error: string }`. Nothing else.
- Error strings on user-facing validation are sometimes Tajik
  (`"Файл лозим аст"`). Match the surrounding file.

## Pagination

Zero-indexed `page` plus `pageSize`, bounded server-side, returning `total` from
a `count: "exact"` select:

```ts
const page = Math.max(0, Number(searchParams.get("page") ?? 0));
const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
const from = page * pageSize;
query = query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
```

Always pair `.range()` with an `.order()` — unordered pagination silently
repeats and drops rows.

## Dates

ISO 8601 UTC strings on the wire, both directions. Date-only filters get
expanded to a full day server-side:

```ts
if (dateFrom) query = query.gte("created_at", new Date(`${dateFrom}T00:00:00.000Z`).toISOString());
if (dateTo)   query = query.lte("created_at", new Date(`${dateTo}T23:59:59.999Z`).toISOString());
```

## Input

No Zod. Parse and bound every parameter by hand, and escape anything reaching a
Supabase filter:

```ts
const s = search.slice(0, 100).replace(/[%_\\]/g, "\\$&");
query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
```

Never trust `user_id`, `status`, `moderation_status`, or any admin flag from the
request body.

## Verify

```bash
npx tsc --noEmit
```

Then exercise the route against `npm run dev` — signed out (expect 401),
signed in as a non-owner (expect 403/404), and as the owner. For admin routes,
confirm a non-admin gets 404.
