# Supabase Production Audit — juyo (aztuszloghjkynukjkaa)

Conducted via direct SQL introspection against the live database (`information_schema`, `pg_catalog`, `pg_policies`, `storage.*`). No changes have been applied — every fix below is a **proposal** with migration SQL, pending your approval per your instructions.

---

## 🔴 CRITICAL — fix immediately (active data exposure)

### C1. `profiles` table is publicly readable — full PII leak
**Finding:** RLS policy `profiles_select_public` on `public.profiles`:
```sql
cmd: SELECT, qual: true, roles: {public}
```
This allows **anyone**, including unauthenticated requests with just the anon key, to run `GET /rest/v1/profiles?select=*` and read **every user's** `phone`, `secondary_phone`, `first_name`, `last_name`, `accepted_terms`, `terms_version` for all 24 rows currently in the table.

**Why it's a problem:** `phone`/`secondary_phone` are PII. The app already has a `public_profiles` **view** (`id, first_name, last_name, avatar_url, created_at` — no phone) specifically so the client can expose *safe* fields publicly. This policy defeats that separation and leaks the sensitive columns directly. There are also two other overlapping/legacy SELECT policies on the same table (`"Users can view own profile"` and `profiles_owner_manage`'s ALL clause) — redundant but harmless; `profiles_select_public` is the actual hole.

**Proposed fix:**
```sql
-- Migration: 001_fix_profiles_public_select.sql
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can manage own profile" on public.profiles;
-- profiles_owner_manage (ALL, owner-only) already covers legitimate self-access.
```
After this, only the owner (matched via JWT `sub`/`user_id`) can read their own `profiles` row; public consumers keep using the `public_profiles` view, which is unaffected.

---

### C2. Service-role JWT hardcoded in a database trigger (full DB compromise risk)
**Finding:** Trigger ` on_item_created_moderate` on `items` (INSERT + UPDATE) calls `supabase_functions.http_request(...)` with:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...role":"service_role"...exp:2091629531
```
That JWT decodes to `role: service_role`, expiring in **2036**. It's stored in plaintext inside the trigger's `action_statement`, visible to anyone who can read `information_schema.triggers` / `pg_trigger` (and to any tool, dashboard export, or backup that touches that metadata).

**Why it's a problem:** `service_role` bypasses **all** RLS — full read/write on every table. A key with this scope should never be embedded in object DDL. This is the single most sensitive credential in the project and it's sitting in plain text in schema metadata.

**Proposed fix:** Move the secret into **Supabase Vault** and reference it, instead of inlining it:
```sql
-- Migration: 002_move_service_key_to_vault.sql
select vault.create_secret('<NEW_SERVICE_ROLE_KEY>', 'service_role_key_for_triggers');

create or replace function public.trigger_image_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key_for_triggers';
  perform net.http_post(
    url := 'https://aztuszloghjkynukjkaa.supabase.co/functions/v1/image-moderation',
    headers := jsonb_build_object('Content-type','application/json','Authorization','Bearer '||v_key),
    body := '{}'::jsonb
  );
  return new;
end;
$$;

drop trigger if exists " on_item_created_moderate" on public.items;
create trigger on_item_created_moderate
  after insert or update on public.items
  for each row execute function public.trigger_image_moderation();
```
**You must also rotate the service-role key in the Supabase dashboard** (Settings → API) regardless, since the current one has been sitting in plaintext — treat it as compromised the same way we treated the leaked access token earlier in this session.

---

### C3. Any authenticated user can delete any other user's uploaded photos
**Finding:** Storage policy on `storage.objects`, bucket `items`:
```sql
policyname: "Enable delete for users based on user_id", roles: {authenticated}, cmd: DELETE, qual: true
```
No ownership check at all — `qual: true` means every authenticated user can delete every file in the bucket, not just their own. Two other, correctly-scoped DELETE policies exist (`"Allow authenticated users to delete images"`, `"Owners can delete their images"`) but since storage policies are PERMISSIVE (OR'd together), the wide-open one wins regardless.

**Proposed fix:**
```sql
-- Migration: 003_fix_storage_delete_policy.sql
drop policy if exists "Enable delete for users based on user_id" on storage.objects;
-- Keep only the owner-scoped delete policies (already present):
--   "Allow authenticated users to delete images"
--   "Owners can delete their images"
```
Also clean up duplicate INSERT/SELECT storage policies while touching this (cosmetic, not a security issue since the bucket is intentionally public-read):
```sql
drop policy if exists " Allow authenticated users to upload 1numdc_0" on storage.objects; -- keep "Authenticated Users Upload"
drop policy if exists "Enable read access for all users" on storage.objects; -- keep "Public Access to Images" or "Public read access", drop the other duplicate too
```

---

## 🟠 HIGH — real bugs / dead code / performance

### H1. `match_items_visual()` is dead code that would crash if called
References `i.embedding` on `public.items` — **that column does not exist** (confirmed via `information_schema.columns`; embeddings live on `item_images.embedding` now). Zero references to this function anywhere in the codebase (`visual-search` edge function correctly calls `match_item_images` instead). This is leftover from an earlier schema (one-embedding-per-item → migrated to one-embedding-per-image) and was never cleaned up.
```sql
-- Migration: 004_drop_dead_function.sql
drop function if exists public.match_items_visual(vector, double precision, integer);
```

### H2. `SECURITY DEFINER` functions without a pinned `search_path`
`increment_item_views()` and `is_secure_user()` are `SECURITY DEFINER` with `proconfig: null` (no `search_path` set). This is Postgres/Supabase's classic search-path-hijack surface for definer functions (flagged by Supabase's own security linter). `match_item_images()` already does this correctly (`SET search_path = 'public'`) — the other two don't.
```sql
-- Migration: 005_pin_search_path.sql
alter function public.increment_item_views(uuid) set search_path = public;
alter function public.is_secure_user() set search_path = public;
```

### H3. `is_secure_user()` and `get_auth_id()` are unused dead code
Zero references in the app codebase, and — notably — `get_auth_id()` isn't even used *inside* the RLS policies it was seemingly built for: every policy (`items_owner_manage`, `profiles_owner_manage`, `safety_box_owner_manage`, `saved_items_owner_manage`) independently repeats the same inline expression:
```sql
COALESCE(current_setting('request.jwt.claims',true)::json->>'user_id',
         current_setting('request.jwt.claims',true)::json->>'sub')
```
instead of calling `get_auth_id()` once. That's 5x duplicated logic — a maintainability risk (if the Clerk JWT claim name ever changes, you have to edit 5 policies instead of 1 function).
```sql
-- Migration: 006_consolidate_auth_helper.sql (recommended, not just cleanup)
-- Redefine get_auth_id() to match current logic (it already does), then repoint every policy:
alter policy items_owner_manage on public.items
  using (get_auth_id() = user_id) with check (get_auth_id() = user_id);
alter policy items_select_visible on public.items
  using (moderation_status = 'approved' or get_auth_id() = user_id);
alter policy profiles_owner_manage on public.profiles
  using (get_auth_id() = id) with check (get_auth_id() = id);
alter policy safety_box_owner_manage on public.safety_box
  using (get_auth_id() = user_id) with check (get_auth_id() = user_id);
alter policy saved_items_owner_manage on public.saved_items
  using (get_auth_id() = user_id) with check (get_auth_id() = user_id);
alter policy images_owner_manage on public.item_images
  using (exists (select 1 from items where items.id = item_images.item_id and items.user_id = get_auth_id()))
  with check (exists (select 1 from items where items.id = item_images.item_id and items.user_id = get_auth_id()));
alter policy images_select_visible on public.item_images
  using (exists (select 1 from items where items.id = item_images.item_id and (items.moderation_status = 'approved' or items.user_id = get_auth_id())));
-- is_secure_user() truly has no caller anywhere — safe to drop, or keep if you plan to use it server-side:
drop function if exists public.is_secure_user();
```

### H4. Missing index on `item_images.item_id` (foreign key)
Every item-detail page load joins `item_images` on `item_id` (and the moderation trigger fires per-item too). There is **no index** on this FK column — Postgres will sequential-scan `item_images` for every lookup as the table grows.
```sql
-- Migration: 007_add_missing_fk_index.sql
create index if not exists idx_item_images_item_id on public.item_images (item_id);
```

### H5. Duplicate indexes (wasted writes + storage, zero benefit)
```sql
-- items: idx_items_status and idx_items_moderation both index (moderation_status)
-- saved_items: idx_saved_items_user_id and idx_saved_items_user both index (user_id)
-- Migration: 008_drop_duplicate_indexes.sql
drop index if exists public.idx_items_status;        -- keep idx_items_moderation
drop index if exists public.idx_saved_items_user;     -- keep idx_saved_items_user_id
```

---

## 🟡 MEDIUM — schema hygiene / production-readiness

### M1. No `supabase/migrations/` directory in the repo
The entire schema (tables, RLS, triggers, functions) was built ad-hoc — there is no versioned migration history. This means the schema can't be reproduced from scratch, there's no changelog, and no clean rollback path. **Recommendation:** run `supabase db pull` once (needs Docker, or I can do it via the Management API dump endpoint) to baseline the current schema into `supabase/migrations/`, then every fix in this report becomes its own migration file going forward instead of an ad-hoc dashboard edit.

### M2. `audit_log` has RLS enabled with zero policies
Not a bug (default-deny means it's currently inaccessible via PostgREST to anon/authenticated, which is probably intended if only service-role/Edge Functions write to it) — but worth confirming that's the intended design, since as-is even the table owner via the API can't read it back for an in-app "activity log" feature if one is ever wanted client-side.

### M3. `saved_items` primary key is a composite `(user_id, item_id)`
This is correct and intentional for a join table — no action needed, noted only because it looked unusual at first glance in the constraints dump (two `PRIMARY KEY` rows for the same constraint name is normal Postgres reporting for composite keys, not a duplicate-PK bug).

---

## Row counts (context, not a finding)
`items`: 8 · `profiles`: 24 · `saved_items`: 0 — this is a low-traffic/early-stage project, which is exactly why now (before real scale) is the right time to close C1–C3.

---

## Suggested order of operations
1. **C1, C2, C3 today** — these are live data-exposure/integrity risks, independent of each other, safe to apply in any order.
2. **Rotate the service-role key** in the dashboard (manual, can't be scripted) after C2's migration is applied.
3. **H1–H5** — safe, low-risk cleanup, can batch together.
4. **M1** — baseline migrations so everything from here on is tracked.

None of the SQL above has been run. Tell me which migrations to apply (all, or pick numbers) and I'll execute them one at a time via the Management API and confirm each result.
