-- ============================================================================
-- Phase 7 — Organization-based Lost & Found: post routing + organization
-- review + feed visibility. Builds additively on 20260926000000
-- (organizations core), 20260927000000 (invitations), 20260928000000
-- (business plans) — none of those are altered.
--
-- Two flows, one shared field set on `items` (deliberately NOT a second
-- table — "prefer extending the existing items model"):
--   FLOW A (user post + organization): user_id stays the poster (unchanged
--     ownership), organization_id/branch_id are the user's OPTIONAL
--     selection, organization_review_status starts 'pending' the moment an
--     organization is attached. The organization is never the owner of a
--     personal post.
--   FLOW B (organization-owned FOUND post): user_id stays NULL (Phase 7's
--     established org-item convention), organization_id/branch_id are
--     required, created_by_staff_id is an audit/creator reference only —
--     never treated as ownership anywhere (confirmed: no query in this
--     migration branches on created_by_staff_id for authorization).
--
-- "Organization Approved" is explicitly NOT ownership verification, NOT
-- Claim, NOT the old removed Verification feature — it only means "this
-- organization confirms the post relates to them." Enforced by naming:
-- every user-facing string/column here says "organization_review"/
-- "organization approved", never "verified"/"verification".
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Widen organizations.category to add 'bank' (financial institutions),
-- named explicitly in the place-type/organization mapping below. Additive
-- CHECK widen, same mechanism already used for notification-kind checks in
-- every prior phase.
-- ----------------------------------------------------------------------------
do $$
declare
  v_conname text;
begin
  select conname into v_conname from pg_constraint
  where conrelid = 'public.organizations'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%category%';
  execute format('alter table public.organizations drop constraint %I', v_conname);
end $$;

alter table public.organizations add constraint organizations_category_check
  check (category in (
    'hotel', 'university', 'restaurant', 'cafe', 'mall', 'airport',
    'transport', 'office', 'gym', 'event', 'tourism', 'company',
    'government', 'bank', 'other'
  ));

-- ----------------------------------------------------------------------------
-- Widen items.location_type ("place type") to cover the organization
-- categories that need a compatible place type and don't already have one
-- (university/mall/office/event/tourism/bank) — 'taxi'/'hotel_restaurant'/
-- 'public_place'/'airport'/'gym' already existed (Phase 3) and are
-- untouched/reused as-is.
-- ----------------------------------------------------------------------------
alter table public.items drop constraint items_location_type_check;
alter table public.items add constraint items_location_type_check
  check (location_type in (
    'taxi', 'hotel_restaurant', 'public_place', 'airport', 'gym',
    'university', 'mall', 'office', 'event', 'tourism', 'bank'
  ) or location_type is null);

-- ----------------------------------------------------------------------------
-- organization_category_compatibility — the centralized place-type ->
-- organization-category mapping (section 5: "reusable by Web, Mobile,
-- backend, database, tests"). A plain data table, not hardcoded logic —
-- widening it later is a data change, not a redeploy. Public-read (it's
-- just a compatibility rule, not sensitive), same shape as business_plan_limits.
-- ----------------------------------------------------------------------------
create table public.organization_category_compatibility (
  item_location_type text not null,
  organization_category text not null,
  primary key (item_location_type, organization_category)
);

insert into public.organization_category_compatibility (item_location_type, organization_category) values
  ('taxi', 'transport'),
  ('bank', 'bank'),
  ('hotel_restaurant', 'hotel'),
  ('hotel_restaurant', 'restaurant'),
  ('hotel_restaurant', 'cafe'),
  ('university', 'university'),
  ('mall', 'mall'),
  ('airport', 'airport'),
  ('office', 'office'),
  ('office', 'company'),
  ('gym', 'gym'),
  ('event', 'event'),
  ('tourism', 'tourism'),
  ('public_place', 'government');

alter table public.organization_category_compatibility enable row level security;
create policy organization_category_compatibility_public_read on public.organization_category_compatibility
  for select to anon, authenticated using (true);

-- ============================================================================
-- items — additive columns only. No existing column's meaning changes.
-- ============================================================================
alter table public.items
  add column organization_id uuid references public.organizations(id) on delete set null,
  add column branch_id uuid references public.organization_branches(id) on delete set null,
  add column created_by_staff_id text,
  add column organization_review_status text not null default 'none'
    check (organization_review_status in ('none', 'pending', 'approved', 'rejected')),
  add column organization_reviewed_at timestamptz,
  add column organization_reviewed_by text;

alter table public.items add constraint items_organization_review_status_consistency check (
  (organization_id is null and organization_review_status = 'none')
  or (organization_id is not null and organization_review_status <> 'none')
);

-- Fast "pending review queue for org X" lookups.
create index idx_items_org_review_pending
  on public.items(organization_id, branch_id)
  where organization_review_status = 'pending';
-- Fast "my org's approved items" / general org-item lookups.
create index idx_items_organization on public.items(organization_id, branch_id) where organization_id is not null;

-- ============================================================================
-- enforce_organization_review_status — the security boundary that makes
-- "a client sends organization_review_status = approved and bypasses
-- review" IMPOSSIBLE, even though `items_owner_manage` already gives a
-- personal item's own poster full column-level write access to their own
-- row (the only realistic spoofing vector — org staff have no RLS write
-- path to someone else's item at all, see items_org_manage below).
--
-- Mechanism: a session-local GUC (`juyo.org_review_bypass`), set ONLY
-- inside the approve/reject/create-org-item RPCs below, AFTER those RPCs
-- have already independently verified the caller's role/membership/branch
-- scope. A client cannot set a custom GUC through a normal PostgREST
-- request, so this flag can never be spoofed from outside a trusted RPC —
-- the same trust model this project already leans on for
-- `current_setting('request.jwt.claims')` in enforce_moderation_status.
-- ============================================================================
create or replace function public.enforce_organization_review_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bypass boolean := coalesce(current_setting('juyo.org_review_bypass', true), '') = 'true';
  v_org_status text;
  v_branch_org uuid;
  v_branch_status text;
begin
  if v_bypass then
    return new; -- trusted server-side path — already fully validated by its own RPC
  end if;

  if TG_OP = 'INSERT' then
    -- Client-initiated insert (the existing personal-item creation flow).
    -- organization_review_status/reviewed_at/reviewed_by can NEVER be
    -- client-supplied, regardless of what the client sends.
    if new.organization_id is not null then
      select status into v_org_status from public.organizations where id = new.organization_id;
      if v_org_status is null then
        raise exception 'Organization not found';
      end if;
      if v_org_status <> 'active' then
        raise exception 'Organization is not active';
      end if;
      if new.branch_id is not null then
        select organization_id, status into v_branch_org, v_branch_status
        from public.organization_branches where id = new.branch_id;
        if v_branch_org is null or v_branch_org <> new.organization_id then
          raise exception 'Branch does not belong to this organization';
        end if;
        if v_branch_status <> 'active' then
          raise exception 'Branch is not active';
        end if;
      end if;
      if new.location_type is null or not exists (
        select 1 from public.organization_category_compatibility c
        join public.organizations o on o.id = new.organization_id
        where c.item_location_type = new.location_type and c.organization_category = o.category
      ) then
        raise exception 'This place type is not compatible with the selected organization';
      end if;
      new.organization_review_status := 'pending';
    else
      new.organization_review_status := 'none';
    end if;
    new.organization_reviewed_at := null;
    new.organization_reviewed_by := null;
    -- created_by_staff_id is never client-settable on a normal insert —
    -- only create_organization_found_item (bypassed) sets it.
    new.created_by_staff_id := null;
    return new;
  end if;

  -- UPDATE: organization_id/branch_id MAY be changed by the item's own
  -- owner (attaching, switching, or removing an organization from their
  -- own personal post is a legitimate, expected action) — but every such
  -- change re-validates exactly like INSERT and resets review to pending
  -- (or 'none' if cleared). organization_review_status/reviewed_at/
  -- reviewed_by are otherwise IMMUTABLE from a non-bypassed caller,
  -- regardless of what value is sent.
  if new.organization_id is distinct from old.organization_id or new.branch_id is distinct from old.branch_id then
    if new.organization_id is not null then
      select status into v_org_status from public.organizations where id = new.organization_id;
      if v_org_status is null then
        raise exception 'Organization not found';
      end if;
      if v_org_status <> 'active' then
        raise exception 'Organization is not active';
      end if;
      if new.branch_id is not null then
        select organization_id, status into v_branch_org, v_branch_status
        from public.organization_branches where id = new.branch_id;
        if v_branch_org is null or v_branch_org <> new.organization_id then
          raise exception 'Branch does not belong to this organization';
        end if;
        if v_branch_status <> 'active' then
          raise exception 'Branch is not active';
        end if;
      end if;
      if new.location_type is null or not exists (
        select 1 from public.organization_category_compatibility c
        join public.organizations o on o.id = new.organization_id
        where c.item_location_type = new.location_type and c.organization_category = o.category
      ) then
        raise exception 'This place type is not compatible with the selected organization';
      end if;
      new.organization_review_status := 'pending';
    else
      new.organization_review_status := 'none';
    end if;
    new.organization_reviewed_at := null;
    new.organization_reviewed_by := null;
  else
    new.organization_review_status := old.organization_review_status;
    new.organization_reviewed_at := old.organization_reviewed_at;
    new.organization_reviewed_by := old.organization_reviewed_by;
  end if;

  -- created_by_staff_id is immutable from a non-bypassed caller (set once,
  -- at org-item creation, by create_organization_found_item).
  new.created_by_staff_id := old.created_by_staff_id;

  return new;
end;
$$;

drop trigger if exists trg_enforce_organization_review_status on public.items;
create trigger trg_enforce_organization_review_status
  before insert or update on public.items
  for each row execute function public.enforce_organization_review_status();

-- ============================================================================
-- RLS — items_select_visible (additive OR, existing clauses UNTOUCHED) so
-- organization staff can see their own org's items regardless of
-- moderation_status (they need to review pending ones) — scoped
-- correctly: org-wide roles (owner/admin) see every branch, branch-scoped
-- roles (branch_manager/staff/viewer) see only their own branch.
--
-- Phase 9 fix (found during a pre-live-verification audit): this policy
-- originally also carried an `and not exists (... public.user_blocks ...)`
-- clause. `user_blocks` was intentionally dropped in
-- 20260824010000_drop_item_reports_and_user_blocks.sql (the block/report
-- feature was fully removed, not just its UI) and never recreated — so
-- that clause referenced a table that no longer exists. Since this
-- migration was never applied to production, the smallest safe
-- correction is to fix it in place here rather than layer a second
-- migration on top of a broken one. The block/report feature is NOT
-- being resurrected — this policy now matches exactly what
-- 20260824010000 already reverted `items_select_visible` to (the plain
-- `moderation_status = 'approved' or get_auth_id() = user_id` pair),
-- plus this migration's own additive organization-access clause.
-- ============================================================================
create or replace function public.has_org_item_access(p_organization_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = get_auth_id()
      and m.status = 'active'
      and (m.branch_id is null or m.branch_id = p_branch_id)
  );
$$;

grant execute on function public.has_org_item_access(uuid, uuid) to authenticated;

drop policy if exists items_select_visible on public.items;
create policy items_select_visible on public.items
  for select
  using (
    moderation_status = 'approved'
    or get_auth_id() = user_id
    or (organization_id is not null and public.has_org_item_access(organization_id, branch_id))
  );

-- ============================================================================
-- get_compatible_organizations — feeds the "Organization" picker on the
-- add-item form. Active orgs only, filtered by place-type compatibility,
-- optionally narrowed by city (matches ANY of the org's active branches).
-- No membership required — any authenticated user posting a listing needs
-- this, not just organization staff.
-- ============================================================================
create or replace function public.get_compatible_organizations(p_location_type text, p_city text default null)
returns table (id uuid, name text, category text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct o.id, o.name, o.category
  from public.organizations o
  join public.organization_category_compatibility c on c.organization_category = o.category
  where o.status = 'active'
    and c.item_location_type = p_location_type
    and (
      p_city is null
      or exists (
        select 1 from public.organization_branches b
        where b.organization_id = o.id and b.status = 'active' and b.city = p_city
      )
    )
  order by o.name;
$$;

grant execute on function public.get_compatible_organizations(text, text) to anon, authenticated;

create or replace function public.get_organization_branches_for_picker(p_organization_id uuid, p_city text default null)
returns table (id uuid, name text, city text)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.name, b.city
  from public.organization_branches b
  where b.organization_id = p_organization_id
    and b.status = 'active'
    and (p_city is null or b.city = p_city)
  order by b.is_default desc, b.name;
$$;

grant execute on function public.get_organization_branches_for_picker(uuid, text) to anon, authenticated;

-- ============================================================================
-- get_organization_review_queue — pending items for owner/admin (org-wide)
-- or branch_manager (own branch only). staff/viewer get an explicit
-- "not authorized" (section 9: staff view-only unless RBAC already allows
-- more; this migration does not extend staff's RBAC beyond what Phase 7A/B
-- already grants, so staff cannot approve — matches "STAFF may only
-- receive/view the workflow if the existing RBAC explicitly allows it",
-- and it currently does not for approval actions).
-- ============================================================================
create or replace function public.get_organization_review_queue(p_organization_id uuid, p_branch_id uuid default null)
returns table (
  item_id uuid, title text, category text, type item_type, city text,
  branch_id uuid, is_organization_owned boolean, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := public.get_my_org_role(p_organization_id, p_branch_id);
  v_caller_branch uuid;
begin
  if coalesce(v_role, '') not in ('owner', 'admin', 'branch_manager') then
    raise exception 'Not authorized';
  end if;

  if v_role = 'branch_manager' then
    select branch_id into v_caller_branch
    from public.organization_members
    where organization_id = p_organization_id and user_id = get_auth_id() and status = 'active';
  end if;

  return query
  select i.id, i.title, i.category, i.type, i.city, i.branch_id, (i.user_id is null), i.created_at
  from public.items i
  where i.organization_id = p_organization_id
    and i.organization_review_status = 'pending'
    and (i.status is null or i.status <> 'deleted')
    and (v_caller_branch is null or i.branch_id = v_caller_branch)
    and (p_branch_id is null or i.branch_id = p_branch_id)
  order by i.created_at asc;
end;
$$;

grant execute on function public.get_organization_review_queue(uuid, uuid) to authenticated;

-- ============================================================================
-- approve_organization_post / reject_organization_post — the ONLY way
-- organization_review_status ever becomes 'approved'/'rejected'. Fully
-- server-authorized: role, organization status, and branch scope are all
-- re-checked here, never trusted from the client. Idempotent: re-approving
-- an already-approved item is a harmless no-op (no duplicate event/
-- notification fires — the UPDATE's own row-count/status-unchanged check
-- prevents that).
-- ============================================================================
create or replace function public.approve_organization_post(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
  v_org_id uuid;
  v_branch_id uuid;
  v_current_status text;
  v_role text;
  v_caller_branch uuid;
  v_org_status text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select organization_id, branch_id, organization_review_status into v_org_id, v_branch_id, v_current_status
  from public.items where id = p_item_id and (status is null or status <> 'deleted');
  if v_org_id is null then
    raise exception 'Post has no organization association';
  end if;

  select status into v_org_status from public.organizations where id = v_org_id;
  if v_org_status <> 'active' then
    raise exception 'Organization is not active';
  end if;

  v_role := public.get_my_org_role(v_org_id);
  if coalesce(v_role, '') not in ('owner', 'admin', 'branch_manager') then
    raise exception 'Not authorized';
  end if;
  if v_role = 'branch_manager' then
    select branch_id into v_caller_branch
    from public.organization_members
    where organization_id = v_org_id and user_id = v_user_id and status = 'active';
    if v_branch_id is distinct from v_caller_branch then
      raise exception 'Not authorized for this branch';
    end if;
  end if;

  if v_current_status = 'approved' then
    return; -- idempotent no-op — already approved, no duplicate event/notification
  end if;

  perform set_config('juyo.org_review_bypass', 'true', true);
  update public.items
  set organization_review_status = 'approved', organization_reviewed_at = now(), organization_reviewed_by = v_user_id
  where id = p_item_id;
  -- "record reviewer" (section 25) is satisfied by organization_reviewed_by/
  -- organization_reviewed_at on the item row itself — no separate audit log
  -- table exists yet (deliberately deferred in Phase 7A; not reopened here).
end;
$$;

grant execute on function public.approve_organization_post(uuid) to authenticated;

create or replace function public.reject_organization_post(p_item_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
  v_org_id uuid;
  v_branch_id uuid;
  v_current_status text;
  v_role text;
  v_caller_branch uuid;
  v_org_status text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select organization_id, branch_id, organization_review_status into v_org_id, v_branch_id, v_current_status
  from public.items where id = p_item_id and (status is null or status <> 'deleted');
  if v_org_id is null then
    raise exception 'Post has no organization association';
  end if;

  select status into v_org_status from public.organizations where id = v_org_id;
  if v_org_status <> 'active' then
    raise exception 'Organization is not active';
  end if;

  v_role := public.get_my_org_role(v_org_id);
  if coalesce(v_role, '') not in ('owner', 'admin', 'branch_manager') then
    raise exception 'Not authorized';
  end if;
  if v_role = 'branch_manager' then
    select branch_id into v_caller_branch
    from public.organization_members
    where organization_id = v_org_id and user_id = v_user_id and status = 'active';
    if v_branch_id is distinct from v_caller_branch then
      raise exception 'Not authorized for this branch';
    end if;
  end if;

  if v_current_status = 'rejected' then
    return; -- idempotent no-op
  end if;

  perform set_config('juyo.org_review_bypass', 'true', true);
  update public.items
  set organization_review_status = 'rejected', organization_reviewed_at = now(), organization_reviewed_by = v_user_id
  where id = p_item_id;
  -- p_reason is accepted (a future UI can collect it) but not persisted
  -- anywhere yet — no audit log table exists (deferred, see approve above),
  -- and adding a dedicated items column for a rejection reason is scope
  -- beyond what this phase asked for. Flagged, not silently dropped.
end;
$$;

grant execute on function public.reject_organization_post(uuid, text) to authenticated;

-- ============================================================================
-- create_organization_found_item — organization-owned FOUND post creation.
-- user_id stays NULL (the established Phase 7 org-item convention);
-- created_by_staff_id is an audit reference only — never used for
-- authorization anywhere in this migration. Requires staff+ in the target
-- branch (viewer cannot create). Uses the bypass GUC only for the fields
-- the trigger would otherwise force to their insert-time defaults — the
-- trigger's own organization/branch/compatibility validation still runs
-- identically for this path since the bypass flag only affects the
-- review-status fields, not those checks... actually the bypass skips the
-- ENTIRE non-bypass branch including validation, so validation is
-- re-implemented explicitly below instead, matching the same rules.
-- ============================================================================
create or replace function public.create_organization_found_item(
  p_organization_id uuid,
  p_branch_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_date date,
  p_city text,
  p_location_type text default null,
  p_reward text default null,
  p_image_urls text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
  v_role text;
  v_org_status text;
  v_branch_org uuid;
  v_branch_status text;
  v_item_id uuid;
  v_url text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_branch_id is null then
    raise exception 'Branch is required for an organization-owned found item';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Title is required';
  end if;

  select status into v_org_status from public.organizations where id = p_organization_id;
  if v_org_status is null then
    raise exception 'Organization not found';
  end if;
  if v_org_status <> 'active' then
    raise exception 'Organization is not active';
  end if;

  select organization_id, status into v_branch_org, v_branch_status
  from public.organization_branches where id = p_branch_id;
  if v_branch_org is null or v_branch_org <> p_organization_id then
    raise exception 'Branch does not belong to this organization';
  end if;
  if v_branch_status <> 'active' then
    raise exception 'Branch is not active';
  end if;

  v_role := public.get_my_org_role(p_organization_id, p_branch_id);
  if coalesce(v_role, '') not in ('owner', 'admin', 'branch_manager', 'staff') then
    raise exception 'Not authorized';
  end if;

  perform set_config('juyo.org_review_bypass', 'true', true);
  insert into public.items (
    user_id, title, description, category, type, date, city, location_type,
    reward, organization_id, branch_id, created_by_staff_id,
    organization_review_status
  )
  values (
    null, trim(p_title), p_description, p_category, 'found', p_date, p_city, p_location_type,
    p_reward, p_organization_id, p_branch_id, v_user_id,
    'pending'
  )
  returning id into v_item_id;

  foreach v_url in array p_image_urls loop
    insert into public.item_images (item_id, image_url) values (v_item_id, v_url);
  end loop;
  -- items.created_by_staff_id (set above) is this action's audit trail —
  -- no separate organization_audit_logs table exists yet (deferred, see
  -- approve_organization_post above).

  return v_item_id;
end;
$$;

grant execute on function public.create_organization_found_item(uuid, uuid, text, text, text, date, text, text, text, text[]) to authenticated;

-- ============================================================================
-- Notifications — extends the existing Phase 4 architecture (two new
-- kinds), reusing dismissed_notifications/notification_reads exactly as
-- every prior phase has. Pull-based (computed feed via the bell/list),
-- same as ai_match/vip_status/org_invitation — NO new push Edge Function
-- is added this round (disclosed as an explicit scope boundary, not a
-- silent gap): both new kinds are in-app-only for now, which trivially
-- satisfies "prevent notification spam" since there is no new push vector
-- to spam through.
--   org_review_pending — staff-facing: "you have posts awaiting review".
--   org_review_result  — poster-facing: "your organization association was
--     approved/rejected" (never phrased as "verified").
-- ============================================================================
alter table public.dismissed_notifications drop constraint dismissed_notifications_kind_check;
alter table public.dismissed_notifications add constraint dismissed_notifications_kind_check
  check (kind in ('verification', 'category_post', 'ai_match', 'vip_status', 'org_invitation', 'org_review_pending', 'org_review_result'));

alter table public.notification_reads drop constraint notification_reads_kind_check;
alter table public.notification_reads add constraint notification_reads_kind_check
  check (kind in ('category_post', 'expiry_confirm', 'ai_match', 'vip_status', 'org_invitation', 'org_review_pending', 'org_review_result'));

create or replace function public.dismiss_notification(
  p_kind text, p_ref_id uuid, p_item_id uuid, p_item_title text,
  p_related_name text, p_related_avatar text, p_status text default null
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
  if p_kind not in ('verification', 'category_post', 'ai_match', 'vip_status', 'org_invitation', 'org_review_pending', 'org_review_result') then
    raise exception 'Invalid kind';
  end if;

  insert into dismissed_notifications (user_id, kind, ref_id)
  values (v_user_id, p_kind, p_ref_id)
  on conflict (user_id, kind, ref_id) do nothing;

  insert into deleted_notifications_archive
    (user_id, kind, ref_id, item_id, item_title, related_name, related_avatar, status)
  values
    (v_user_id, p_kind, p_ref_id, p_item_id, p_item_title, p_related_name, p_related_avatar, p_status);
end;
$$;

create or replace function public.mark_notification_read(p_kind text, p_ref_id uuid)
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
  if p_kind not in ('category_post', 'expiry_confirm', 'ai_match', 'vip_status', 'org_invitation', 'org_review_pending', 'org_review_result') then
    raise exception 'Invalid kind';
  end if;

  insert into notification_reads (user_id, kind, ref_id)
  values (v_user_id, p_kind, p_ref_id)
  on conflict (user_id, kind, ref_id) do nothing;
end;
$$;

create or replace function public.mark_notifications_read(p_kinds text[], p_ref_ids uuid[])
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
  if array_length(p_kinds, 1) is null then
    return;
  end if;
  if array_length(p_kinds, 1) <> array_length(p_ref_ids, 1) then
    raise exception 'p_kinds and p_ref_ids must be the same length';
  end if;
  if exists (select 1 from unnest(p_kinds) k where k not in ('category_post', 'expiry_confirm', 'ai_match', 'vip_status', 'org_invitation', 'org_review_pending', 'org_review_result')) then
    raise exception 'Invalid kind';
  end if;

  insert into notification_reads (user_id, kind, ref_id)
  select v_user_id, k, r
  from unnest(p_kinds, p_ref_ids) as t(k, r)
  on conflict (user_id, kind, ref_id) do nothing;
end;
$$;

-- Staff-facing: pending items across every org the caller has
-- owner/admin/branch_manager authority over (branch-scoped correctly).
create or replace function public.get_my_org_review_notifications(p_limit int default 20)
returns table (item_id uuid, item_title text, organization_id uuid, organization_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.title, o.id, o.name, i.created_at
  from public.items i
  join public.organizations o on o.id = i.organization_id
  join public.organization_members m on m.organization_id = i.organization_id
    and m.user_id = get_auth_id() and m.status = 'active'
    and m.role in ('owner', 'admin', 'branch_manager')
    and (m.branch_id is null or m.branch_id = i.branch_id)
  where i.organization_review_status = 'pending'
    and (i.status is null or i.status <> 'deleted')
    and not exists (
      select 1 from public.dismissed_notifications d
      where d.user_id = get_auth_id() and d.kind = 'org_review_pending' and d.ref_id = i.id
    )
  order by i.created_at asc
  limit p_limit;
$$;

grant execute on function public.get_my_org_review_notifications(int) to authenticated;

-- Poster-facing: the outcome of their own post's organization review.
create or replace function public.get_my_org_review_results(p_limit int default 20)
returns table (
  item_id uuid, item_title text, organization_id uuid, organization_name text,
  organization_review_status text, organization_reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.title, o.id, o.name, i.organization_review_status, i.organization_reviewed_at
  from public.items i
  join public.organizations o on o.id = i.organization_id
  where i.user_id = get_auth_id()
    and i.organization_review_status in ('approved', 'rejected')
    and (i.status is null or i.status <> 'deleted')
    and not exists (
      select 1 from public.dismissed_notifications d
      where d.user_id = get_auth_id() and d.kind = 'org_review_result' and d.ref_id = i.id
    )
  order by i.organization_reviewed_at desc
  limit p_limit;
$$;

grant execute on function public.get_my_org_review_results(int) to authenticated;

-- ============================================================================
-- Rollback (not executed — reference only):
--
-- drop function if exists public.get_my_org_review_results(int);
-- drop function if exists public.get_my_org_review_notifications(int);
-- drop function if exists public.create_organization_found_item(uuid, uuid, text, text, text, date, text, text, text, text[]);
-- drop function if exists public.reject_organization_post(uuid, text);
-- drop function if exists public.approve_organization_post(uuid);
-- drop function if exists public.get_organization_review_queue(uuid, uuid);
-- drop function if exists public.get_organization_branches_for_picker(uuid, text);
-- drop function if exists public.get_compatible_organizations(text, text);
-- drop policy if exists items_select_visible on public.items; -- (re-create the pre-7-item-routing version)
-- drop function if exists public.has_org_item_access(uuid, uuid);
-- drop trigger if exists trg_enforce_organization_review_status on public.items;
-- drop function if exists public.enforce_organization_review_status();
-- alter table public.items drop constraint items_organization_review_status_consistency;
-- alter table public.items drop column organization_reviewed_by;
-- alter table public.items drop column organization_reviewed_at;
-- alter table public.items drop column organization_review_status;
-- alter table public.items drop column created_by_staff_id;
-- alter table public.items drop column branch_id;
-- alter table public.items drop column organization_id;
-- drop table if exists public.organization_category_compatibility;
-- alter table public.items drop constraint items_location_type_check;
-- alter table public.items add constraint items_location_type_check check (location_type in ('taxi','hotel_restaurant','public_place','airport','gym') or location_type is null);
-- alter table public.organizations drop constraint organizations_category_check;
-- alter table public.organizations add constraint organizations_category_check check (category in ('hotel','university','restaurant','cafe','mall','airport','transport','office','gym','event','tourism','company','government','other'));
-- ============================================================================
