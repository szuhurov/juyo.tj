-- ============================================================================
-- Phase 9A — Analytics foundation: item lifecycle history + analytics
-- indexes + the security scaffolding later Phase 9 RPCs build on.
--
-- THE GAP THIS CLOSES: `cleanup-expired-posts` (the daily expiry cron) has
-- always hard-deleted expired items with no archival at all — confirmed by
-- reading its source directly (supabase/functions/cleanup-expired-posts/index.ts),
-- not assumed. That means "how many items expired last month" has never
-- been reconstructable. This migration adds `item_lifecycle_events` — a
-- minimal, append-only event log modeled directly on the existing
-- `subscription_events`/`organization_subscription_events` shape (same
-- columns: actor_type/actor_id/metadata/created_at) rather than inventing
-- a new pattern — and a BEFORE DELETE trigger so the 'expired'/'deleted'
-- event is captured EVEN IF a future code path deletes an item without
-- remembering to log it (the instruction to make this "not depend only on
-- the client" — a trigger is the only way to guarantee that for a DELETE,
-- since the row is gone the instant the client's own request completes).
--
-- Builds additively on 20260711200000 (items) .. 20260930000001 (AI match
-- fix) — none of those are altered by this file except the trigger install
-- itself (new triggers, no existing trigger/policy touched).
-- ============================================================================

create table if not exists public.item_lifecycle_events (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null, -- NOT a FK to items(id) — a 'deleted'/'expired' event
                              -- must survive the row it describes being removed.
  event_type  text not null check (event_type in (
                 'created', 'approved', 'rejected', 'resolved', 'expired', 'deleted'
               )),
  actor_type  text not null check (actor_type in ('user', 'staff', 'admin', 'system')),
  actor_id    text, -- Clerk id (poster or org staff) — same convention as
                     -- subscription_events.actor_id; never a name/phone/email.
  -- Deliberately minimal — category/city/type/moderation snapshot only,
  -- never title/description/phone/reward (those stay in items /
  -- deleted_items_archive's full snapshot, which is a separate,
  -- narrower-audience, service-role-only table).
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_item_lifecycle_events_item on public.item_lifecycle_events(item_id);
create index if not exists idx_item_lifecycle_events_type_created on public.item_lifecycle_events(event_type, created_at);

-- RLS enabled, zero client policies — same convention as item_matches /
-- dismissed_notifications / organization_subscription_events: nobody
-- reads this directly over PostgREST, every read goes through a
-- SECURITY DEFINER analytics RPC (Phase 9B/9C/9D) that decides, per
-- caller, which rows are in scope.
alter table public.item_lifecycle_events enable row level security;

-- ============================================================================
-- capture_item_lifecycle_event — AFTER INSERT/UPDATE on items. SECURITY
-- DEFINER so it can write into item_lifecycle_events regardless of the
-- calling role's own grants (same reasoning as enforce_organization_review_status).
-- ============================================================================
create or replace function public.capture_item_lifecycle_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.item_lifecycle_events (item_id, event_type, actor_type, actor_id, metadata)
    values (
      new.id, 'created',
      case when new.organization_id is not null then 'staff' else 'user' end,
      coalesce(new.created_by_staff_id, new.user_id),
      jsonb_build_object('category', new.category, 'type', new.type, 'city', new.city)
    );
    return new;
  end if;

  -- UPDATE — only fire on an actual transition, never on an unrelated
  -- column change (e.g. views incrementing), so this can't be spammed.
  if new.moderation_status is distinct from old.moderation_status then
    if new.moderation_status = 'approved' then
      insert into public.item_lifecycle_events (item_id, event_type, actor_type, metadata)
      values (new.id, 'approved', 'system', jsonb_build_object('category', new.category));
    elsif new.moderation_status = 'rejected' then
      insert into public.item_lifecycle_events (item_id, event_type, actor_type, metadata)
      values (new.id, 'rejected', 'system', jsonb_build_object('category', new.category));
    end if;
  end if;

  if new.is_resolved is distinct from old.is_resolved and new.is_resolved then
    insert into public.item_lifecycle_events (item_id, event_type, actor_type, actor_id, metadata)
    values (new.id, 'resolved', 'user', new.user_id, jsonb_build_object('category', new.category));
  end if;

  -- Soft-delete (ItemService.deleteItem — status='deleted', row stays).
  -- The separate hard-delete path below (BEFORE DELETE) covers the row
  -- being physically removed; a soft-deleted row may or may not later be
  -- hard-deleted, so both are legitimate, independent 'deleted' events —
  -- distinguished by metadata.mode, not double-counted (this UPDATE branch
  -- only fires once, on the actual active→deleted transition).
  if new.status is distinct from old.status and new.status = 'deleted' then
    insert into public.item_lifecycle_events (item_id, event_type, actor_type, actor_id, metadata)
    values (new.id, 'deleted', 'user', new.user_id, jsonb_build_object('mode', 'soft', 'category', new.category));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_item_lifecycle_insert on public.items;
create trigger trg_item_lifecycle_insert
  after insert on public.items
  for each row execute function public.capture_item_lifecycle_event();

drop trigger if exists trg_item_lifecycle_update on public.items;
create trigger trg_item_lifecycle_update
  after update on public.items
  for each row execute function public.capture_item_lifecycle_event();

-- ============================================================================
-- capture_item_deletion_event — BEFORE DELETE. Guarantees a 'deleted' (or
-- 'expired') event exists no matter which code path removes the row —
-- today that's hardDeleteItem (user's own "Delete"), the admin
-- permanent-delete route, and cleanup-expired-posts (Edge Function).
-- `juyo.item_deletion_reason` is a transaction-local GUC (same mechanism
-- as juyo.org_review_bypass in 20260929000000) — set to 'expired' only by
-- the new expire_item() RPC below; every other delete path leaves it
-- unset and gets the 'deleted' default. This intentionally does NOT
-- distinguish user-delete from admin-delete (both are the ordinary,
-- expected "deleted" case) — a scope decision, not an oversight.
-- ============================================================================
create or replace function public.capture_item_deletion_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := coalesce(nullif(current_setting('juyo.item_deletion_reason', true), ''), 'deleted');
begin
  insert into public.item_lifecycle_events (item_id, event_type, actor_type, actor_id, metadata)
  values (
    old.id, v_reason,
    case when v_reason = 'expired' then 'system' else 'user' end,
    old.user_id,
    jsonb_build_object('mode', 'hard', 'category', old.category, 'had_moderation_status', old.moderation_status)
  );
  return old;
end;
$$;

drop trigger if exists trg_item_lifecycle_delete on public.items;
create trigger trg_item_lifecycle_delete
  before delete on public.items
  for each row execute function public.capture_item_deletion_event();

-- ============================================================================
-- expire_item — replaces the raw `.from("items").delete()` call in
-- cleanup-expired-posts. Atomic: sets the reason GUC and deletes in the
-- same statement's trigger firing, so the 'expired' event and the row
-- removal can never happen out of step with each other. service_role-only
-- — same reasoning as run_ai_matching_for_item: no internal identity
-- check, so the default PUBLIC execute grant must be revoked explicitly.
-- ============================================================================
create or replace function public.expire_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('juyo.item_deletion_reason', 'expired', true);
  delete from public.items where id = p_item_id;
end;
$$;

revoke execute on function public.expire_item(uuid) from public, anon, authenticated;
grant execute on function public.expire_item(uuid) to service_role;

-- ============================================================================
-- Analytics indexes — justified by the Phase 9 org/branch/admin dashboard
-- query shapes (organization/branch-scoped range aggregation, city/category
-- distribution, match volume over time). Not added speculatively: every
-- index below backs a specific query in the RPCs added later in this phase.
-- ============================================================================
create index if not exists idx_items_org_branch_created
  on public.items(organization_id, branch_id, created_at)
  where organization_id is not null;

create index if not exists idx_items_city_created
  on public.items(city, created_at);

create index if not exists idx_items_category_created
  on public.items(category, created_at);

create index if not exists idx_item_matches_created_at
  on public.item_matches(created_at);

-- ============================================================================
-- Sensitive-action audit log — Phase 9 scope only: "admin report accessed"
-- and "export generated" (per explicit product decision — NOT a general
-- audit_log revival; the old audit_log table, dropped 20260713010000, is
-- deliberately not being resurrected wholesale, only this narrow slice).
-- ============================================================================
create table if not exists public.analytics_audit_events (
  id          uuid primary key default gen_random_uuid(),
  event_type  text not null check (event_type in ('admin_report_accessed', 'export_generated')),
  actor_id    text not null, -- Clerk id of the admin/org member who acted
  scope       text not null check (scope in ('user', 'organization', 'branch', 'admin')),
  scope_id    text, -- organization_id/branch_id when scope is org/branch; null for admin/user
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_analytics_audit_events_actor on public.analytics_audit_events(actor_id, created_at desc);

alter table public.analytics_audit_events enable row level security;
-- Zero client policies — written only via record_analytics_audit_event()
-- below (SECURITY DEFINER), read only via the admin analytics RPCs
-- (service_role only), same convention as every other Phase 7/9 event table.

create or replace function public.record_analytics_audit_event(
  p_event_type text, p_scope text, p_scope_id text default null, p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.analytics_audit_events (event_type, actor_id, scope, scope_id, metadata)
  values (p_event_type, v_user_id, p_scope, p_scope_id, p_metadata);
end;
$$;

grant execute on function public.record_analytics_audit_event(text, text, text, jsonb) to authenticated;

-- Admin variant — the admin analytics API route calls the platform RPC
-- via supabaseAdmin (service_role), which carries no Supabase JWT at all
-- (Clerk-admin identity is verified in the Next.js route via isAdminUser,
-- not via get_auth_id()) — so record_analytics_audit_event's
-- get_auth_id()-derived actor would always be null there. This variant
-- takes the already-verified admin's Clerk id explicitly instead of
-- deriving it, and is itself service_role-only so it can never be called
-- to forge an arbitrary actor_id from a normal authenticated client.
create or replace function public.admin_record_analytics_audit_event(
  p_admin_user_id text, p_event_type text, p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_admin_user_id is null or length(trim(p_admin_user_id)) = 0 then
    raise exception 'admin user id is required';
  end if;
  insert into public.analytics_audit_events (event_type, actor_id, scope, scope_id, metadata)
  values (p_event_type, p_admin_user_id, 'admin', null, p_metadata);
end;
$$;

revoke execute on function public.admin_record_analytics_audit_event(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_record_analytics_audit_event(text, text, jsonb) to service_role;

-- ============================================================================
-- Rollback (not executed — reference only):
--
-- drop function if exists public.record_analytics_audit_event(text, text, text, jsonb);
-- drop table if exists public.analytics_audit_events;
-- drop index if exists public.idx_item_matches_created_at;
-- drop index if exists public.idx_items_category_created;
-- drop index if exists public.idx_items_city_created;
-- drop index if exists public.idx_items_org_branch_created;
-- revoke execute on function public.expire_item(uuid) from service_role;
-- drop function if exists public.expire_item(uuid);
-- drop trigger if exists trg_item_lifecycle_delete on public.items;
-- drop function if exists public.capture_item_deletion_event();
-- drop trigger if exists trg_item_lifecycle_update on public.items;
-- drop trigger if exists trg_item_lifecycle_insert on public.items;
-- drop function if exists public.capture_item_lifecycle_event();
-- drop table if exists public.item_lifecycle_events;
-- ============================================================================
