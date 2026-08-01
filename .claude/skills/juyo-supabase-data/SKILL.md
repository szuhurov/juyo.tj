---
name: juyo-supabase-data
description: Query and mutate JUYO's Supabase Postgres — the lib/services layer, RLS policies, migrations under supabase/migrations, the search_items RPC, soft vs hard delete, and the Deno Edge Functions. Use when changing data access, adding a migration, debugging an RLS denial or an empty result set, or editing anything under supabase/.
---

# JUYO Supabase data

Follow [security.rules.md](../../rules/security.rules.md) — especially the two
clients and the "never escalate to service-role to dodge RLS" rule.

## Layers

```
components / hooks   lib/hooks/use-*.ts        React Query
service layer        lib/services/*.ts         queries + mutations
clients              lib/supabase.ts           anon / Clerk-JWT (RLS enforced)
                     lib/supabase-admin.ts     service role (RLS BYPASSED, server only)
schema               supabase/migrations/*.sql timestamp-prefixed, no ORM
```

Services: `item-service.ts`, `profile-service.ts`, `item-deletion.ts`,
`account-deletion.ts`, `admin-service.ts`, `stats-service.ts`.

Each service function takes an optional `SupabaseClient` so callers can pass an
authenticated client. Pass it. Falling back to the anon client silently changes
what RLS lets through.

## Migrations are the source of truth

`supabase/migrations/` — timestamp-prefixed SQL, applied via the Supabase
CLI/dashboard. There is no ORM.

`schema.sql`, `rls_policies.sql`, `JUYO_DATABASE_SCHEMA.sql` at the repo root
are **older reference snapshots**. Do not treat them as current. When you need
to know the real shape of a table, read the migrations in order, or query the
live project.

**Never apply a migration yourself.** Write the SQL, explain what it does and
what it means for RLS, and hand it to the user. Same for seeds and backfills.

Naming: `YYYYMMDDHHMMSS_short_description.sql`, matching the existing files.

## Search goes through an RPC

`ItemService.getItems` calls the `search_items` Postgres function, not a plain
`.ilike()` filter — it ranks exact-title matches first and has accumulated
behaviour across several migrations (date range, sort by date, stable order).

Changing search behaviour means writing a new migration that replaces the
function. Do not add a client-side filter on top and call it fixed. Read the
latest `*_search_items_*.sql` before touching it.

## Deletion: two different paths

Do not conflate them.

| Path | What it does |
| --- | --- |
| `ItemService.deleteItem` | soft delete — also used by the "resolved" flow |
| `hardDeleteItem` (`lib/services/item-deletion.ts`) | real deletion + storage cleanup; used by `app/api/items/[id]/delete` |

Soft-deleted rows carry `status = 'deleted'` and must stay out of public
queries, sitemaps, search results and notifications. Deleted items and accounts
are archived (`deleted_items_archive`, `deleted_accounts_archive` migrations).

`hardDeleteItem` returns `{ ok, reason, status }` rather than throwing — the
route maps that to a response. Follow that shape for new deletion logic.

## Query conventions

- Bound pagination server-side; always pair `.range()` with `.order()`.
- Escape user input before it reaches a filter:
  `search.slice(0, 100).replace(/[%_\\]/g, "\\$&")`.
- Use `count: "exact"` when the client needs a total.
- Embedded relations use explicit FK hints:
  `profiles!items_user_id_fkey(first_name, last_name)`.
- Check `error` on every call. A Supabase error is not an exception.

## RLS

Policies live in the migrations. When adding a table or column that holds user
data, add the policy in the same migration — a table with RLS enabled and no
policy denies everything, and a table without RLS enabled is world-readable
through the anon key.

If a query returns empty for a signed-in user but works with `supabaseAdmin`,
that is an RLS problem to fix in SQL, not a reason to switch clients.

## Edge Functions (Deno)

`supabase/functions/`: `clerk-sync`, `image-moderation`, `text-moderation`,
`ai-brain`, `generate-embedding`, `visual-search`, `admin-notify`,
`notify-category-post`, `notify-pending-review`, `notify-qr-scan`,
`cleanup-expired-posts`.

These are the fragile part of the codebase:

- Deno runtime, URL imports — **excluded from ESLint and from `tsconfig.json`**.
  `npm run lint` and `npx tsc --noEmit` do not see them at all.
- Check them with `deno lint <dir>` and `deno check <file>`.
- They hold `SUPABASE_SERVICE_ROLE_KEY`. Every one is a privileged endpoint —
  verify the caller.
- Several are triggered by database triggers defined in migrations. Changing a
  function's contract may mean changing a migration too.
- Do not deploy them. Hand the change to the user.

## Verify

```bash
npx vitest run tests/services/
npx tsc --noEmit
deno lint supabase/functions/<name>    # only if you touched one
deno check supabase/functions/<name>/index.ts
```

The Supabase MCP tools can inspect the live project (`list_tables`,
`execute_sql`, `get_advisors`, `get_logs`) — use them read-only for diagnosis.
Do not use `apply_migration` or `deploy_edge_function` without being asked.
