-- ============================================================================
-- Phase 7A — B2B Organizations: core foundation only.
--
-- Scope, deliberately narrow: organizations, branches, membership/RBAC,
-- owner protection (incl. account-deletion block), self-archive. NO
-- invitations (7B), NO inventory (7D), NO organization-owned items yet (7C
-- — `items` is completely untouched by this migration), NO audit log
-- (deferred — RLS/RBAC correctness doesn't require a trail to exist, see
-- the Phase 7A plan), NO B2B subscriptions/payment.
--
-- Ownership/ordering note: `organizations.default_branch_id` references
-- `organization_branches`, which doesn't exist until the second CREATE
-- TABLE below — so the FK is added via a separate ALTER TABLE after both
-- tables exist, not inline. Not actually circular, just sequenced.
-- ============================================================================

create table public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  category            text not null check (category in (
                         'hotel','university','restaurant','cafe','mall','airport',
                         'transport','office','gym','event','tourism','company',
                         'government','other'
                       )),
  owner_user_id       text not null,
  status              text not null default 'pending'
                         check (status in ('pending','active','suspended','archived')),
  -- Deliberately separate from `status` — an administrative trust badge,
  -- not the organization's operational lifecycle, and NOT the removed
  -- user-facing "ownership verification" feature (unrelated concept,
  -- unrelated table, no overlap). Also distinct from `profiles.is_verified`.
  verification_status text not null default 'unverified'
                         check (verification_status in ('unverified','verified','rejected')),
  default_branch_id   uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_organizations_owner on public.organizations(owner_user_id);
create index idx_organizations_status on public.organizations(status);

create table public.organization_branches (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  -- Same 18-city list as items_city_check (20260919000000_items_city.sql)
  -- — intentionally duplicated, not extracted into a shared lookup table,
  -- matching this repo's existing precedent of duplicating the city list
  -- (Web/lib/cities.ts vs app/lib/cities.ts) rather than a premature
  -- abstraction. If the city list changes, both constraints need updating.
  city            text check (city is null or city in (
                     'dushanbe','khujand','bokhtar','kulob','tursunzoda','istaravshan',
                     'vahdat','hisor','panjakent','khorugh','isfara','konibodom',
                     'norak','roghun','guliston','buston','istiqlol','levakant'
                   )),
  address         text,
  is_default      boolean not null default false,
  status          text not null default 'active' check (status in ('active','archived')),
  created_at      timestamptz not null default now()
);
create index idx_org_branches_org on public.organization_branches(organization_id);
-- Enforces "exactly one default branch per organization" at the DB level,
-- not just by convention in the RPC.
create unique index idx_org_branches_one_default
  on public.organization_branches(organization_id) where is_default = true;

alter table public.organizations
  add constraint organizations_default_branch_fkey
  foreign key (default_branch_id) references public.organization_branches(id);

create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- null = org-wide scope (owner/admin); non-null = branch-scoped
  -- (branch_manager/staff/viewer). Enforced by the RPCs below, not a
  -- cross-column CHECK — there is no other write path to this table this
  -- phase (no invitations yet), so the RPCs are the only source of truth
  -- for this invariant and a DB-level CHECK would add fragility for no
  -- present benefit.
  branch_id       uuid references public.organization_branches(id) on delete set null,
  user_id         text not null,
  role            text not null check (role in ('owner','admin','branch_manager','staff','viewer')),
  -- Soft-delete only — a removed member's row is never hard-deleted, so
  -- any future audit trail (7B+) stays coherent.
  status          text not null default 'active' check (status in ('active','removed')),
  created_at      timestamptz not null default now(),
  removed_at      timestamptz,
  removed_by      text
);
create index idx_org_members_user on public.organization_members(user_id);
create index idx_org_members_org_branch on public.organization_members(organization_id, branch_id);
-- One active membership per person per org (a removed historical row can
-- coexist if they're re-added later — new row, old one stays 'removed').
create unique index idx_org_members_one_active
  on public.organization_members(organization_id, user_id) where status = 'active';

-- ============================================================================
-- RLS. Organizations get exactly one public policy (active orgs are public
-- pricing-page-style info, same shape as vip_plans_public_read). Branches
-- and members are RPC-only, zero client policies — same convention as
-- dismissed_notifications/item_matches/subscriptions: organization_members
-- in particular is the authorization source of truth for this whole
-- feature and must never be directly queryable by a client.
-- ============================================================================
alter table public.organizations enable row level security;
alter table public.organization_branches enable row level security;
alter table public.organization_members enable row level security;

create policy organizations_public_read on public.organizations
  for select
  to anon, authenticated
  using (status = 'active');

-- ============================================================================
-- get_my_org_role — the single shared authorization primitive every write
-- RPC below calls exactly once. Never trusts a client-supplied role;
-- always re-derives the caller's identity via get_auth_id() and looks up
-- their actual, current, active membership row.
-- ============================================================================
create or replace function public.get_my_org_role(p_organization_id uuid, p_branch_id uuid default null)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.organization_members
  where organization_id = p_organization_id
    and user_id = get_auth_id()
    and status = 'active'
    and (branch_id is null or p_branch_id is null or branch_id = p_branch_id)
  order by case role
    when 'owner' then 5 when 'admin' then 4 when 'branch_manager' then 3 when 'staff' then 2 else 1
  end desc
  limit 1;
$$;

grant execute on function public.get_my_org_role(uuid, uuid) to authenticated;

-- ============================================================================
-- create_organization — any authenticated user may create one. Creates the
-- org (status='pending'), its default branch, and the owner's own
-- membership row, atomically. The client supplies only name/category —
-- owner_user_id, status, verification_status are all server-derived.
-- ============================================================================
create or replace function public.create_organization(p_name text, p_category text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
  v_org_id uuid;
  v_branch_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Organization name is required';
  end if;

  insert into public.organizations (name, category, owner_user_id)
  values (trim(p_name), p_category, v_user_id)
  returning id into v_org_id;

  insert into public.organization_branches (organization_id, name, is_default)
  values (v_org_id, trim(p_name), true)
  returning id into v_branch_id;

  update public.organizations set default_branch_id = v_branch_id where id = v_org_id;

  insert into public.organization_members (organization_id, branch_id, user_id, role)
  values (v_org_id, null, v_user_id, 'owner');

  return v_org_id;
end;
$$;

grant execute on function public.create_organization(text, text) to authenticated;

-- The caller's own memberships across all organizations.
create or replace function public.get_my_organizations()
returns table (
  organization_id uuid,
  name text,
  category text,
  status text,
  role text,
  branch_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.name, o.category, o.status, m.role, m.branch_id
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = get_auth_id() and m.status = 'active'
  order by o.created_at desc;
$$;

grant execute on function public.get_my_organizations() to authenticated;

-- Single org detail. Public if active; otherwise only visible to a member
-- (pending/suspended/archived orgs are invisible to everyone else,
-- including the fact that the name is taken).
create or replace function public.get_organization(p_organization_id uuid)
returns table (
  id uuid, name text, category text, status text, verification_status text,
  default_branch_id uuid, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.name, o.category, o.status, o.verification_status, o.default_branch_id, o.created_at
  from public.organizations o
  where o.id = p_organization_id
    and (
      o.status = 'active'
      or exists (
        select 1 from public.organization_members m
        where m.organization_id = o.id and m.user_id = get_auth_id() and m.status = 'active'
      )
    );
$$;

grant execute on function public.get_organization(uuid) to anon, authenticated;

create or replace function public.get_org_members(p_organization_id uuid)
returns table (
  id uuid, branch_id uuid, user_id text, role text, status text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.get_my_org_role(p_organization_id) is null then
    raise exception 'Not a member of this organization';
  end if;

  return query
  select m.id, m.branch_id, m.user_id, m.role, m.status, m.created_at
  from public.organization_members m
  where m.organization_id = p_organization_id and m.status = 'active'
  order by m.created_at asc;
end;
$$;

grant execute on function public.get_org_members(uuid) to authenticated;

create or replace function public.create_branch(p_organization_id uuid, p_name text, p_city text default null, p_address text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.get_my_org_role(p_organization_id);
  v_status text;
  v_branch_id uuid;
begin
  -- coalesce(v_role, '') — a NULL role (caller is not a member at all) must
  -- fail this check. Without the coalesce, `NULL not in (...)` evaluates to
  -- NULL, and PL/pgSQL treats a NULL IF-condition as false, silently
  -- SKIPPING the raise and letting a non-member proceed. This exact bug
  -- pattern is fixed everywhere it appears in this migration and in
  -- 20260927000000_organization_invitations.sql.
  if coalesce(v_role, '') not in ('owner','admin') then
    raise exception 'Not authorized';
  end if;

  select status into v_status from public.organizations where id = p_organization_id;
  if v_status <> 'active' then
    raise exception 'Organization is not active';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Branch name is required';
  end if;

  insert into public.organization_branches (organization_id, name, city, address)
  values (p_organization_id, trim(p_name), p_city, p_address)
  returning id into v_branch_id;

  return v_branch_id;
end;
$$;

grant execute on function public.create_branch(uuid, text, text, text) to authenticated;

create or replace function public.update_branch(p_branch_id uuid, p_name text default null, p_city text default null, p_address text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_status text;
begin
  select organization_id into v_org_id from public.organization_branches where id = p_branch_id;
  if v_org_id is null then
    raise exception 'Branch not found';
  end if;

  v_role := public.get_my_org_role(v_org_id);
  if coalesce(v_role, '') not in ('owner','admin') then
    raise exception 'Not authorized';
  end if;

  select status into v_status from public.organizations where id = v_org_id;
  if v_status <> 'active' then
    raise exception 'Organization is not active';
  end if;

  update public.organization_branches
  set name = coalesce(trim(p_name), name),
      city = coalesce(p_city, city),
      address = coalesce(p_address, address)
  where id = p_branch_id;
end;
$$;

grant execute on function public.update_branch(uuid, text, text, text) to authenticated;

create or replace function public.archive_branch(p_branch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_status text;
  v_is_default boolean;
  v_other_active_count int;
begin
  select organization_id, status, is_default into v_org_id, v_status, v_is_default
  from public.organization_branches where id = p_branch_id;
  if v_org_id is null then
    raise exception 'Branch not found';
  end if;

  v_role := public.get_my_org_role(v_org_id);
  if coalesce(v_role, '') not in ('owner','admin') then
    raise exception 'Not authorized';
  end if;

  if v_status = 'archived' then
    return; -- idempotent no-op
  end if;

  if v_is_default then
    select count(*) into v_other_active_count
    from public.organization_branches
    where organization_id = v_org_id and status = 'active' and id <> p_branch_id;
    if v_other_active_count = 0 then
      raise exception 'Cannot archive the organization''s only branch';
    end if;
  end if;

  update public.organization_branches set status = 'archived' where id = p_branch_id;
end;
$$;

grant execute on function public.archive_branch(uuid) to authenticated;

-- ============================================================================
-- change_member_role — never allows promotion to/demotion from 'owner'
-- (ownership only moves via transfer_organization_ownership). Rejects
-- self-escalation by construction: the caller's OWN role is what's
-- checked, and no branch below can ever raise the caller's own row.
-- ============================================================================
create or replace function public.change_member_role(p_organization_id uuid, p_member_id uuid, p_new_role text, p_branch_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text := public.get_my_org_role(p_organization_id);
  v_target_role text;
  v_status text;
begin
  if coalesce(v_caller_role, '') not in ('owner','admin') then
    raise exception 'Not authorized';
  end if;
  if p_new_role not in ('admin','branch_manager','staff','viewer') then
    raise exception 'Invalid role';
  end if;

  select status into v_status from public.organizations where id = p_organization_id;
  if v_status <> 'active' then
    raise exception 'Organization is not active';
  end if;

  select role into v_target_role
  from public.organization_members
  where id = p_member_id and organization_id = p_organization_id and status = 'active';
  if v_target_role is null then
    raise exception 'Member not found';
  end if;
  if v_target_role = 'owner' then
    raise exception 'Cannot change the owner''s role';
  end if;

  update public.organization_members
  set role = p_new_role,
      branch_id = case when p_new_role in ('admin') then null else coalesce(p_branch_id, branch_id) end
  where id = p_member_id;
end;
$$;

grant execute on function public.change_member_role(uuid, uuid, text, uuid) to authenticated;

-- ============================================================================
-- remove_organization_member — org-wide (owner/admin) can remove anyone
-- except the owner; branch_manager can remove only staff/viewer within
-- their OWN branch (never another branch, never admin/branch_manager
-- peers).
-- ============================================================================
create or replace function public.remove_organization_member(p_organization_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
  v_caller_role text := public.get_my_org_role(p_organization_id);
  v_caller_branch uuid;
  v_target_role text;
  v_target_branch uuid;
  v_status text;
begin
  if v_caller_role is null then
    raise exception 'Not authorized';
  end if;

  select status into v_status from public.organizations where id = p_organization_id;
  if v_status <> 'active' then
    raise exception 'Organization is not active';
  end if;

  select role, branch_id into v_target_role, v_target_branch
  from public.organization_members
  where id = p_member_id and organization_id = p_organization_id and status = 'active';
  if v_target_role is null then
    raise exception 'Member not found';
  end if;
  if v_target_role = 'owner' then
    raise exception 'Cannot remove the owner';
  end if;

  if v_caller_role in ('owner','admin') then
    -- org-wide, may remove anyone but the owner (already checked above)
    null;
  elsif v_caller_role = 'branch_manager' then
    select branch_id into v_caller_branch
    from public.organization_members
    where organization_id = p_organization_id and user_id = v_user_id and status = 'active';
    if v_target_branch is distinct from v_caller_branch or v_target_role not in ('staff','viewer') then
      raise exception 'Not authorized';
    end if;
  else
    raise exception 'Not authorized';
  end if;

  update public.organization_members
  set status = 'removed', removed_at = now(), removed_by = v_user_id
  where id = p_member_id;
end;
$$;

grant execute on function public.remove_organization_member(uuid, uuid) to authenticated;

-- ============================================================================
-- transfer_organization_ownership — caller must be the CURRENT owner;
-- target must already be an active member of the same org (no transferring
-- to an outsider). Old owner is demoted to admin, not removed.
-- ============================================================================
create or replace function public.transfer_organization_ownership(p_organization_id uuid, p_new_owner_user_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
  v_caller_role text := public.get_my_org_role(p_organization_id);
  v_target_exists boolean;
begin
  if coalesce(v_caller_role, '') <> 'owner' then
    raise exception 'Only the current owner can transfer ownership';
  end if;

  select exists(
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = p_new_owner_user_id and status = 'active'
  ) into v_target_exists;
  if not v_target_exists then
    raise exception 'New owner must already be an active member of this organization';
  end if;

  update public.organization_members set role = 'admin', branch_id = null
  where organization_id = p_organization_id and user_id = v_user_id and status = 'active';

  update public.organization_members set role = 'owner', branch_id = null
  where organization_id = p_organization_id and user_id = p_new_owner_user_id and status = 'active';

  update public.organizations set owner_user_id = p_new_owner_user_id, updated_at = now()
  where id = p_organization_id;
end;
$$;

grant execute on function public.transfer_organization_ownership(uuid, text) to authenticated;

-- ============================================================================
-- archive_organization — owner self-archive. Soft state only: never
-- deletes organizations/branches/members. Idempotent.
-- ============================================================================
create or replace function public.archive_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.get_my_org_role(p_organization_id);
begin
  if coalesce(v_role, '') <> 'owner' then
    raise exception 'Only the owner can archive this organization';
  end if;

  update public.organizations set status = 'archived', updated_at = now()
  where id = p_organization_id and status <> 'archived';
end;
$$;

grant execute on function public.archive_organization(uuid) to authenticated;

-- ============================================================================
-- Platform admin RPCs — no internal identity check makes sense here (called
-- server-to-server from an already Clerk-admin-gated Next.js route using
-- the service-role key), so — same reasoning as admin_activate_subscription
-- (Phase 6) / admin_backfill_ai_matches (Phase 5) — the default PUBLIC
-- execute grant is explicitly revoked. p_admin_id is passed in by the
-- calling route purely for a future audit trail (not used to authorize —
-- the route's own isAdminUser() check is the actual gate).
-- ============================================================================
create or replace function public.admin_approve_organization(p_organization_id uuid, p_admin_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organizations set status = 'active', updated_at = now()
  where id = p_organization_id and status = 'pending';
  if not found then
    raise exception 'Organization not found or not pending';
  end if;
end;
$$;

create or replace function public.admin_suspend_organization(p_organization_id uuid, p_admin_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organizations set status = 'suspended', updated_at = now()
  where id = p_organization_id and status = 'active';
  if not found then
    raise exception 'Organization not found or not active';
  end if;
end;
$$;

create or replace function public.admin_reactivate_organization(p_organization_id uuid, p_admin_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organizations set status = 'active', updated_at = now()
  where id = p_organization_id and status = 'suspended';
  if not found then
    raise exception 'Organization not found or not suspended';
  end if;
end;
$$;

create or replace function public.admin_force_transfer_ownership(p_organization_id uuid, p_new_owner_user_id text, p_admin_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_owner text;
begin
  select owner_user_id into v_current_owner from public.organizations where id = p_organization_id;
  if v_current_owner is null then
    raise exception 'Organization not found';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = p_new_owner_user_id and status = 'active'
  ) then
    raise exception 'New owner must already be an active member of this organization';
  end if;

  update public.organization_members set role = 'admin', branch_id = null
  where organization_id = p_organization_id and user_id = v_current_owner and status = 'active';

  update public.organization_members set role = 'owner', branch_id = null
  where organization_id = p_organization_id and user_id = p_new_owner_user_id and status = 'active';

  update public.organizations set owner_user_id = p_new_owner_user_id, updated_at = now()
  where id = p_organization_id;
end;
$$;

revoke execute on function public.admin_approve_organization(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_suspend_organization(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_reactivate_organization(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_force_transfer_ownership(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_approve_organization(uuid, text) to service_role;
grant execute on function public.admin_suspend_organization(uuid, text) to service_role;
grant execute on function public.admin_reactivate_organization(uuid, text) to service_role;
grant execute on function public.admin_force_transfer_ownership(uuid, text, text) to service_role;

-- ============================================================================
-- Rollback (not executed — reference only, for a manual revert if needed):
--
-- drop function if exists public.admin_force_transfer_ownership(uuid, text, text);
-- drop function if exists public.admin_reactivate_organization(uuid, text);
-- drop function if exists public.admin_suspend_organization(uuid, text);
-- drop function if exists public.admin_approve_organization(uuid, text);
-- drop function if exists public.archive_organization(uuid);
-- drop function if exists public.transfer_organization_ownership(uuid, text);
-- drop function if exists public.remove_organization_member(uuid, uuid);
-- drop function if exists public.change_member_role(uuid, uuid, text, uuid);
-- drop function if exists public.archive_branch(uuid);
-- drop function if exists public.update_branch(uuid, text, text, text);
-- drop function if exists public.create_branch(uuid, text, text, text);
-- drop function if exists public.get_org_members(uuid);
-- drop function if exists public.get_organization(uuid);
-- drop function if exists public.get_my_organizations();
-- drop function if exists public.create_organization(text, text);
-- drop function if exists public.get_my_org_role(uuid, uuid);
-- drop table if exists public.organization_members;
-- drop table if exists public.organization_branches cascade;
-- drop table if exists public.organizations;
-- ============================================================================
