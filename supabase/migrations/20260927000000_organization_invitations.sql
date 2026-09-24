-- ============================================================================
-- Phase 7B — Organization Operations: invitations, member management
-- refinements (branch reassignment, leave-organization), and a stricter
-- default-branch protection rule. Builds additively on
-- 20260926000000_organizations_core.sql — no table from that migration is
-- altered at all (only a new table added). One RPC's signature DOES
-- change: archive_branch(uuid) from 7A is explicitly dropped and replaced
-- by archive_branch(uuid, uuid) below (see that section) — a deliberate,
-- documented exception, not an oversight, because create/replace cannot
-- change a signature and leaving the old looser-rule version reachable
-- alongside the new one would defeat the stricter default-branch
-- protection this migration adds.
--
-- Scope, per the approved decisions: invitations to EXISTING JUYO users
-- only (no email/SMS, no unknown-contact resolution — matches "Users must
-- be able to invite an existing JUYO user"). Still no inventory, no
-- organization-owned items, no B2B payment, no retention workflow.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- organization_invitations
-- ----------------------------------------------------------------------------
create table public.organization_invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  branch_id        uuid references public.organization_branches(id) on delete set null,
  invited_user_id  text not null,
  -- 'owner' deliberately excluded — ownership only ever moves via
  -- transfer_organization_ownership (Phase 7A), never through an invitation.
  role             text not null check (role in ('admin','branch_manager','staff','viewer')),
  invited_by       text not null,
  status           text not null default 'pending'
                      check (status in ('pending','accepted','rejected','revoked','expired')),
  expires_at       timestamptz not null default (now() + interval '7 days'),
  responded_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index idx_org_invitations_org on public.organization_invitations(organization_id);
create index idx_org_invitations_invited_user on public.organization_invitations(invited_user_id) where status = 'pending';
-- One pending invitation per (org, invitee) at a time — prevents duplicate
-- spam invites (the RPC also pre-checks this for a friendlier error, but
-- the index is the actual race-safe guard).
create unique index idx_org_invitations_one_pending
  on public.organization_invitations(organization_id, invited_user_id) where status = 'pending';

alter table public.organization_invitations enable row level security;
-- Zero client policies — RPC-only, same convention as organization_members.

-- ============================================================================
-- invite_organization_member
-- Org-wide (owner/admin) may invite any allowed role, to any branch (or
-- org-wide, for 'admin'). branch_manager may invite only 'staff'/'viewer'
-- into their OWN branch. staff/viewer cannot invite at all.
-- ============================================================================
create or replace function public.invite_organization_member(
  p_organization_id uuid,
  p_invited_user_id text,
  p_role text,
  p_branch_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
  v_caller_role text := public.get_my_org_role(p_organization_id);
  v_caller_branch uuid;
  v_org_status text;
  v_branch_org uuid;
  v_branch_status text;
  v_invitation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_role not in ('admin','branch_manager','staff','viewer') then
    raise exception 'Invalid role';
  end if;
  if p_invited_user_id = v_user_id then
    raise exception 'Cannot invite yourself';
  end if;

  select status into v_org_status from public.organizations where id = p_organization_id;
  if v_org_status is null then
    raise exception 'Organization not found';
  end if;
  if v_org_status <> 'active' then
    raise exception 'Organization is not active';
  end if;

  -- Role/branch shape: org-wide role ('admin') must never carry a branch;
  -- branch-scoped roles ('branch_manager'/'staff'/'viewer') always need one.
  if p_role = 'admin' and p_branch_id is not null then
    raise exception 'admin is an organization-wide role and cannot be branch-scoped';
  end if;
  if p_role <> 'admin' and p_branch_id is null then
    raise exception 'This role requires a branch';
  end if;

  if p_branch_id is not null then
    select organization_id, status into v_branch_org, v_branch_status
    from public.organization_branches where id = p_branch_id;
    if v_branch_org is null or v_branch_org <> p_organization_id then
      raise exception 'Branch does not belong to this organization';
    end if;
    if v_branch_status <> 'active' then
      raise exception 'Cannot invite into an archived branch';
    end if;
  end if;

  if v_caller_role in ('owner','admin') then
    null; -- org-wide inviter, any allowed role/branch combination already validated above
  elsif v_caller_role = 'branch_manager' then
    select branch_id into v_caller_branch
    from public.organization_members
    where organization_id = p_organization_id and user_id = v_user_id and status = 'active';
    if p_role not in ('staff','viewer') or p_branch_id is distinct from v_caller_branch then
      raise exception 'Not authorized to invite this role/branch';
    end if;
  else
    raise exception 'Not authorized';
  end if;

  if exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = p_invited_user_id and status = 'active'
  ) then
    raise exception 'User is already a member of this organization';
  end if;
  if exists (
    select 1 from public.organization_invitations
    where organization_id = p_organization_id and invited_user_id = p_invited_user_id and status = 'pending'
  ) then
    raise exception 'This user already has a pending invitation to this organization';
  end if;

  insert into public.organization_invitations (organization_id, branch_id, invited_user_id, role, invited_by)
  values (p_organization_id, p_branch_id, p_invited_user_id, p_role, v_user_id)
  returning id into v_invitation_id;

  return v_invitation_id;
end;
$$;

grant execute on function public.invite_organization_member(uuid, text, text, uuid) to authenticated;

-- Invitations addressed to the caller.
create or replace function public.get_my_invitations()
returns table (
  id uuid, organization_id uuid, organization_name text, branch_id uuid, branch_name text,
  role text, invited_by text, status text, expires_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.organization_id, o.name, i.branch_id, b.name, i.role, i.invited_by, i.status, i.expires_at, i.created_at
  from public.organization_invitations i
  join public.organizations o on o.id = i.organization_id
  left join public.organization_branches b on b.id = i.branch_id
  where i.invited_user_id = get_auth_id() and i.status = 'pending' and i.expires_at > now()
  order by i.created_at desc;
$$;

grant execute on function public.get_my_invitations() to authenticated;

-- Pending invitations for one organization — visible to owner/admin
-- (org-wide) or branch_manager (their own branch's invitations only).
create or replace function public.get_org_invitations(p_organization_id uuid)
returns table (
  id uuid, branch_id uuid, invited_user_id text, role text,
  invited_by text, status text, expires_at timestamptz, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
  v_caller_role text := public.get_my_org_role(p_organization_id);
  v_caller_branch uuid;
begin
  if v_caller_role in ('owner','admin') then
    return query
    select i.id, i.branch_id, i.invited_user_id, i.role, i.invited_by, i.status, i.expires_at, i.created_at
    from public.organization_invitations i
    where i.organization_id = p_organization_id and i.status = 'pending'
    order by i.created_at desc;
  elsif v_caller_role = 'branch_manager' then
    select branch_id into v_caller_branch
    from public.organization_members
    where organization_id = p_organization_id and user_id = v_user_id and status = 'active';
    return query
    select i.id, i.branch_id, i.invited_user_id, i.role, i.invited_by, i.status, i.expires_at, i.created_at
    from public.organization_invitations i
    where i.organization_id = p_organization_id and i.status = 'pending' and i.branch_id = v_caller_branch
    order by i.created_at desc;
  else
    raise exception 'Not authorized';
  end if;
end;
$$;

grant execute on function public.get_org_invitations(uuid) to authenticated;

-- ============================================================================
-- accept_organization_invitation — atomic + race-safe. The single
-- UPDATE...WHERE status='pending' is the race guard: two concurrent
-- accepts (or an accept racing a revoke) can only have one winner: the
-- loser's row count is 0, `if not found` fires a clean error, never a
-- double membership row. Re-checks org is still active and, if
-- branch-scoped, that the branch is still active — an invitation issued
-- before a suspension/archival cannot be accepted into a now-inactive
-- context.
-- ============================================================================
create or replace function public.accept_organization_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
  v_org_id uuid;
  v_branch_id uuid;
  v_role text;
  v_org_status text;
  v_branch_status text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.organization_invitations
  set status = 'accepted', responded_at = now()
  where id = p_invitation_id
    and invited_user_id = v_user_id
    and status = 'pending'
    and expires_at > now()
  returning organization_id, branch_id, role into v_org_id, v_branch_id, v_role;

  if not found then
    raise exception 'Invitation no longer valid';
  end if;

  select status into v_org_status from public.organizations where id = v_org_id;
  if v_org_status <> 'active' then
    -- Roll the invitation back to pending is NOT safe here (another accept
    -- could race it) — instead, mark it expired-equivalent by leaving it
    -- 'accepted' but refusing membership creation would leave a dangling
    -- accepted-but-not-a-member state. Simplest correct behavior: fail the
    -- whole call, which (being a single function invocation) rolls back
    -- the UPDATE above too — Postgres function bodies are transactional.
    raise exception 'Organization is no longer active';
  end if;

  if v_branch_id is not null then
    select status into v_branch_status from public.organization_branches where id = v_branch_id;
    if v_branch_status <> 'active' then
      raise exception 'Branch is no longer active';
    end if;
  end if;

  if exists (
    select 1 from public.organization_members
    where organization_id = v_org_id and user_id = v_user_id and status = 'active'
  ) then
    raise exception 'Already a member of this organization';
  end if;

  insert into public.organization_members (organization_id, branch_id, user_id, role)
  values (v_org_id, v_branch_id, v_user_id, v_role);
end;
$$;

grant execute on function public.accept_organization_invitation(uuid) to authenticated;

create or replace function public.reject_organization_invitation(p_invitation_id uuid)
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

  update public.organization_invitations
  set status = 'rejected', responded_at = now()
  where id = p_invitation_id and invited_user_id = v_user_id and status = 'pending' and expires_at > now();

  if not found then
    raise exception 'Invitation no longer valid';
  end if;
end;
$$;

grant execute on function public.reject_organization_invitation(uuid) to authenticated;

-- revoke_invitation — the original inviter, or any org-wide owner/admin,
-- may cancel a still-pending invitation.
create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
  v_org_id uuid;
  v_invited_by text;
  v_caller_role text;
begin
  -- Explicit, first: with v_user_id NULL (unauthenticated), `v_invited_by =
  -- v_user_id` below would evaluate to NULL rather than false, which would
  -- make the "positive form" authorization check underneath NULL too —
  -- and PL/pgSQL treats a NULL IF-condition as false, silently skipping
  -- the raise. This check closes that specific hole.
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select organization_id, invited_by into v_org_id, v_invited_by
  from public.organization_invitations where id = p_invitation_id and status = 'pending';
  if v_org_id is null then
    raise exception 'Invitation not found or not pending';
  end if;

  v_caller_role := public.get_my_org_role(v_org_id);
  -- Positive form + coalesce, deliberately: "allowed if I'm the inviter OR
  -- an org-wide admin/owner" — written as a single well-defined boolean
  -- rather than a negated AND, so a NULL v_caller_role (non-member) can
  -- never accidentally slip through PL/pgSQL's NULL-in-IF-is-false
  -- behavior the way `x <> y and role not in (...)` did in an earlier draft.
  if not (v_invited_by = v_user_id or coalesce(v_caller_role, '') in ('owner','admin')) then
    raise exception 'Not authorized';
  end if;

  update public.organization_invitations
  set status = 'revoked', responded_at = now()
  where id = p_invitation_id and status = 'pending';
end;
$$;

grant execute on function public.revoke_invitation(uuid) to authenticated;

-- Housekeeping only (never relied on for correctness — accept/reject/
-- revoke all re-check `expires_at > now()` live, exactly like every other
-- "never trust only a cron" mechanism in this project). Mirrors
-- expire_stale_subscriptions (Phase 6).
create or replace function public.expire_stale_invitations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.organization_invitations
  set status = 'expired'
  where status = 'pending' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expire_stale_invitations() from public, anon, authenticated;
grant execute on function public.expire_stale_invitations() to service_role;

select cron.schedule(
  'expire-stale-org-invitations',
  '*/15 * * * *',
  $$select public.expire_stale_invitations();$$
);

-- ============================================================================
-- leave_organization — self-removal. The owner cannot leave (must transfer
-- first, exactly like the account-deletion block) — this closes the same
-- "never silently orphan an organization" gap for the leave path, not just
-- the account-deletion path.
-- ============================================================================
create or replace function public.leave_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
  v_role text := public.get_my_org_role(p_organization_id);
begin
  if v_role is null then
    raise exception 'Not a member of this organization';
  end if;
  if v_role = 'owner' then
    raise exception 'The owner cannot leave — transfer ownership first';
  end if;

  update public.organization_members
  set status = 'removed', removed_at = now(), removed_by = v_user_id
  where organization_id = p_organization_id and user_id = v_user_id and status = 'active';
end;
$$;

grant execute on function public.leave_organization(uuid) to authenticated;

-- ============================================================================
-- change_member_branch — moves a branch-scoped member (branch_manager/
-- staff/viewer) to another active branch in the SAME organization.
-- Org-wide roles (owner/admin) never have a branch to change. Restricted
-- to owner/admin (branch structure is an organization-wide concern, same
-- reasoning as create_branch/archive_branch already being owner/admin-only
-- in Phase 7A).
-- ============================================================================
create or replace function public.change_member_branch(p_organization_id uuid, p_member_id uuid, p_new_branch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text := public.get_my_org_role(p_organization_id);
  v_target_role text;
  v_branch_org uuid;
  v_branch_status text;
begin
  -- coalesce guards against PL/pgSQL treating a NULL IF-condition as
  -- false: without it, a non-member (v_caller_role NULL) would silently
  -- skip this raise instead of being rejected. Same fix applied to every
  -- bare `<role> not in (...)`/`<role> <> 'x'` check across both
  -- organization migrations.
  if coalesce(v_caller_role, '') not in ('owner','admin') then
    raise exception 'Not authorized';
  end if;

  select role into v_target_role
  from public.organization_members
  where id = p_member_id and organization_id = p_organization_id and status = 'active';
  if v_target_role is null then
    raise exception 'Member not found';
  end if;
  if v_target_role in ('owner','admin') then
    raise exception 'This member has an organization-wide role and cannot be branch-assigned';
  end if;

  select organization_id, status into v_branch_org, v_branch_status
  from public.organization_branches where id = p_new_branch_id;
  if v_branch_org is null or v_branch_org <> p_organization_id then
    raise exception 'Branch does not belong to this organization';
  end if;
  if v_branch_status <> 'active' then
    raise exception 'Cannot assign to an archived branch';
  end if;

  update public.organization_members set branch_id = p_new_branch_id where id = p_member_id;
end;
$$;

grant execute on function public.change_member_branch(uuid, uuid, uuid) to authenticated;

-- ============================================================================
-- archive_branch — REPLACED (stricter than the Phase 7A version):
-- 1. The default branch can never be archived, period — "the default
--    branch cannot accidentally disappear" is now a hard rule, not just
--    protected when it's the org's only branch. Reassigning which branch
--    is default is out of scope for 7B (no such RPC exists yet) — flagged
--    as a Phase 7C+ concern if a real need arises.
-- 2. A branch with active members attached MUST have them reassigned in
--    the same call (`p_reassign_members_to`) — they can never be silently
--    left pointing at an archived branch. If the branch has active
--    members and no reassignment target is given (or the target is
--    invalid), the archive is rejected outright.
-- ============================================================================
-- create or replace can't change a function's signature — it would leave
-- the old 1-arg archive_branch(uuid) (Phase 7A's looser rule) callable
-- alongside this one instead of replacing it. Must drop it explicitly.
drop function if exists public.archive_branch(uuid);

create or replace function public.archive_branch(p_branch_id uuid, p_reassign_members_to uuid default null)
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
  v_active_member_count int;
  v_target_org uuid;
  v_target_status text;
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
    raise exception 'Cannot archive the default branch';
  end if;

  select count(*) into v_active_member_count
  from public.organization_members
  where branch_id = p_branch_id and status = 'active';

  if v_active_member_count > 0 then
    if p_reassign_members_to is null then
      raise exception 'This branch has active members — provide p_reassign_members_to';
    end if;
    select organization_id, status into v_target_org, v_target_status
    from public.organization_branches where id = p_reassign_members_to;
    if v_target_org is null or v_target_org <> v_org_id then
      raise exception 'Reassignment target branch does not belong to this organization';
    end if;
    if v_target_status <> 'active' then
      raise exception 'Reassignment target branch is not active';
    end if;
    if p_reassign_members_to = p_branch_id then
      raise exception 'Reassignment target must be a different branch';
    end if;

    update public.organization_members
    set branch_id = p_reassign_members_to
    where branch_id = p_branch_id and status = 'active';
  end if;

  update public.organization_branches set status = 'archived' where id = p_branch_id;
end;
$$;

grant execute on function public.archive_branch(uuid, uuid) to authenticated;

-- ============================================================================
-- Widen the Phase 4 notification-kind checks so a future organization
-- notification surface (Phase 7C+) can reuse the exact same architecture —
-- added now only because the CHECK constraint is cheap/safe to widen
-- ahead of time and avoids a further migration touching this shared
-- constraint later; NO notification-producing code is added in 7B itself
-- (no RPC in this migration writes an 'org_invitation' notification row —
-- invitations are discovered via get_my_invitations(), a direct pull, not
-- a push/notification-feed entry yet). This keeps category_post/
-- expiry_confirm/ai_match/vip_status completely untouched.
-- ============================================================================
alter table public.dismissed_notifications drop constraint dismissed_notifications_kind_check;
alter table public.dismissed_notifications add constraint dismissed_notifications_kind_check
  check (kind in ('verification','category_post','ai_match','vip_status','org_invitation'));

alter table public.notification_reads drop constraint notification_reads_kind_check;
alter table public.notification_reads add constraint notification_reads_kind_check
  check (kind in ('category_post','expiry_confirm','ai_match','vip_status','org_invitation'));

-- ============================================================================
-- Rollback (not executed — reference only):
--
-- alter table public.dismissed_notifications drop constraint dismissed_notifications_kind_check;
-- alter table public.dismissed_notifications add constraint dismissed_notifications_kind_check
--   check (kind in ('verification','category_post','ai_match','vip_status'));
-- alter table public.notification_reads drop constraint notification_reads_kind_check;
-- alter table public.notification_reads add constraint notification_reads_kind_check
--   check (kind in ('category_post','expiry_confirm','ai_match','vip_status'));
-- select cron.unschedule('expire-stale-org-invitations');
-- drop function if exists public.archive_branch(uuid, uuid);
-- -- (re-create the Phase 7A single-arg archive_branch(uuid) here if truly rolling back)
-- drop function if exists public.change_member_branch(uuid, uuid, uuid);
-- drop function if exists public.leave_organization(uuid);
-- drop function if exists public.expire_stale_invitations();
-- drop function if exists public.revoke_invitation(uuid);
-- drop function if exists public.reject_organization_invitation(uuid);
-- drop function if exists public.accept_organization_invitation(uuid);
-- drop function if exists public.get_org_invitations(uuid);
-- drop function if exists public.get_my_invitations();
-- drop function if exists public.invite_organization_member(uuid, text, text, uuid);
-- drop table if exists public.organization_invitations;
-- ============================================================================
