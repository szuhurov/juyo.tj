-- Decommission Phase 7 (B2B organizations) and the Phase 8 (B2G/government)
-- residue that lived inside it. JUYO goes back to individual users only:
-- LOST -> FOUND -> AI MATCH -> NOTIFICATION -> CONTACT.
--
-- Production state checked right before writing this (2026-09-27):
--   organizations / members / branches / invitations / org subscriptions: 0 rows
--   items with organization_id / branch_id / created_by_staff_id: 0
--   items.organization_review_status: 111 rows, all 'none' (the default)
--   analytics_audit_events: 0 rows; lifecycle 'staff' events: 0; org notification reads: 0
--   reference data only: business_plans 4, business_plan_limits 36,
--   business_plan_prices 7, organization_category_compatibility 14 (incl. 'government')
--
-- ORDER OF RELEASE: apply only AFTER the Web deploy and the new mobile build
-- that no longer call any organization RPC — the currently shipped app still
-- calls get_my_org_review_* on the notifications screen.
--
-- NOT reversible by migration: rollback = restore from a Supabase backup taken
-- right before applying. Personal VIP/VVIP (vip_plans, subscriptions,
-- subscription_events) is untouched.

-- 0. Refuse to run if real organization data appeared since the audit.
do $$
begin
  if exists (select 1 from public.organizations)
     or exists (select 1 from public.items where organization_id is not null or branch_id is not null or created_by_staff_id is not null)
  then
    raise exception 'Organization data exists — decommission aborted, review it first';
  end if;
end $$;

-- 1. Scheduled job for invitations.
select cron.unschedule(jobid) from cron.job where jobname = 'expire-stale-org-invitations';

-- 2. items: visibility policy without the organization branch.
drop policy if exists items_select_visible on public.items;
create policy items_select_visible on public.items
  for select
  using ((moderation_status = 'approved'::moderation_status) or (get_auth_id() = user_id));

-- 3. items: organization-only trigger, constraints, indexes, columns.
drop trigger if exists trg_enforce_organization_review_status on public.items;
alter table public.items drop constraint if exists items_organization_review_status_consistency;
alter table public.items drop constraint if exists items_organization_review_status_check;
alter table public.items drop constraint if exists items_organization_id_fkey;
alter table public.items drop constraint if exists items_branch_id_fkey;
drop index if exists public.idx_items_org_review_pending;
drop index if exists public.idx_items_organization;
drop index if exists public.idx_items_org_branch_created;
alter table public.items
  drop column if exists organization_id,
  drop column if exists branch_id,
  drop column if exists created_by_staff_id,
  drop column if exists organization_review_status,
  drop column if exists organization_reviewed_at,
  drop column if exists organization_reviewed_by;

-- 4. Shared functions rewritten without organization logic.
create or replace function public.capture_item_lifecycle_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.item_lifecycle_events (item_id, event_type, actor_type, actor_id, metadata)
    values (
      new.id, 'created', 'user', new.user_id,
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

  -- Soft-delete (status='deleted', row stays); the BEFORE DELETE trigger
  -- covers a hard delete — distinguished by metadata.mode.
  if new.status is distinct from old.status and new.status = 'deleted' then
    insert into public.item_lifecycle_events (item_id, event_type, actor_type, actor_id, metadata)
    values (new.id, 'deleted', 'user', new.user_id, jsonb_build_object('mode', 'soft', 'category', new.category));
  end if;

  return new;
end;
$$;

create or replace function public.get_my_analytics_summary(p_days integer default 30)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_user_id text := get_auth_id();
  v_since timestamptz;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  v_since := case when p_days is null then null else now() - make_interval(days => p_days) end;

  select jsonb_build_object(
    'totalPosts', count(*) filter (where true),
    'lostPosts', count(*) filter (where type = 'lost'),
    'foundPosts', count(*) filter (where type = 'found'),
    'activePosts', count(*) filter (where coalesce(status, 'active') = 'active' and not is_resolved),
    'resolvedPosts', count(*) filter (where is_resolved)
  )
  into v_result
  from public.items
  where user_id = v_user_id;

  v_result := v_result
    || jsonb_build_object(
      'expiredPosts', (select count(*) from public.item_lifecycle_events where actor_id = v_user_id and event_type = 'expired'),
      'savedItemsCount', (select count(*) from public.saved_items where user_id = v_user_id),
      'matchesReceived', (
        select count(*) from public.item_matches m
        join public.items i on i.id = m.lost_item_id or i.id = m.found_item_id
        where i.user_id = v_user_id
      ),
      'activityTrend', coalesce((
        select jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d)
        from (
          select date_trunc('day', created_at)::date as d, count(*) as c
          from public.items
          where user_id = v_user_id
            and (v_since is null or created_at >= v_since)
          group by 1
        ) t
      ), '[]'::jsonb)
    );

  return v_result;
end;
$$;

create or replace function public.admin_get_platform_analytics(p_days integer default 30)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_since timestamptz := now() - make_interval(days => p_days);
  v_result jsonb;
begin
  select jsonb_build_object(
    'totalUsers', (select count(*) from public.profiles),
    'newUsers', (select count(*) from public.profiles where created_at >= v_since)
  ) into v_result;

  select v_result || jsonb_build_object(
    'totalPosts', count(*),
    'lostPosts', count(*) filter (where type = 'lost'),
    'foundPosts', count(*) filter (where type = 'found'),
    'activePosts', count(*) filter (where coalesce(status, 'active') = 'active' and not is_resolved),
    'resolvedPosts', count(*) filter (where is_resolved),
    'pendingModeration', count(*) filter (where moderation_status = 'pending'),
    'approvedModeration', count(*) filter (where moderation_status = 'approved'),
    'rejectedModeration', count(*) filter (where moderation_status = 'rejected')
  )
  into v_result
  from public.items
  where created_at >= v_since;

  select v_result || jsonb_build_object(
    'expiredPosts', count(*) filter (where event_type = 'expired'),
    'deletedPosts', count(*) filter (where event_type = 'deleted')
  )
  into v_result
  from public.item_lifecycle_events
  where created_at >= v_since;

  select v_result || jsonb_build_object('itemsByCity', coalesce(jsonb_agg(jsonb_build_object('city', city, 'count', c) order by c desc), '[]'::jsonb))
  into v_result
  from (select city, count(*) as c from public.items where created_at >= v_since group by city) t;

  select v_result || jsonb_build_object('itemsByCategory', coalesce(jsonb_agg(jsonb_build_object('category', category, 'count', c) order by c desc), '[]'::jsonb))
  into v_result
  from (select category, count(*) as c from public.items where created_at >= v_since group by category) t;

  select v_result || jsonb_build_object(
    'totalMatches', count(*),
    'matchesLow', count(*) filter (where score >= 40 and score < 60),
    'matchesMid', count(*) filter (where score >= 60 and score < 80),
    'matchesHigh', count(*) filter (where score >= 80)
  )
  into v_result
  from public.item_matches m
  where m.created_at >= v_since;

  select v_result || jsonb_build_object(
    'pushVolumeByKind', coalesce((
      select jsonb_object_agg(kind, cnt) from (
        select kind, count(*) as cnt from public.push_notification_log
        where created_at >= v_since group by kind
      ) x(kind, cnt)
    ), '{}'::jsonb),
    'notificationReads', (select count(*) from public.notification_reads where read_at >= v_since),
    'notificationDismissals', (select count(*) from public.dismissed_notifications where created_at >= v_since)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.dismiss_notification(p_kind text, p_ref_id uuid, p_item_id uuid, p_item_title text, p_related_name text, p_related_avatar text, p_status text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id text := get_auth_id();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_kind not in ('verification', 'category_post', 'ai_match', 'vip_status') then
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
set search_path to 'public'
as $$
declare
  v_user_id text := get_auth_id();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_kind not in ('category_post', 'expiry_confirm', 'ai_match', 'vip_status') then
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
set search_path to 'public'
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
  if exists (select 1 from unnest(p_kinds) k where k not in ('category_post', 'expiry_confirm', 'ai_match', 'vip_status')) then
    raise exception 'Invalid kind';
  end if;

  insert into notification_reads (user_id, kind, ref_id)
  select v_user_id, k, r
  from unnest(p_kinds, p_ref_ids) as t(k, r)
  on conflict (user_id, kind, ref_id) do nothing;
end;
$$;

-- 5. CHECK constraints on shared tables: drop the organization values
--    (0 rows use them — verified above).
alter table public.notification_reads drop constraint if exists notification_reads_kind_check;
alter table public.notification_reads add constraint notification_reads_kind_check
  check (kind = any (array['category_post', 'expiry_confirm', 'ai_match', 'vip_status']));
alter table public.dismissed_notifications drop constraint if exists dismissed_notifications_kind_check;
alter table public.dismissed_notifications add constraint dismissed_notifications_kind_check
  check (kind = any (array['verification', 'category_post', 'ai_match', 'vip_status']));
alter table public.item_lifecycle_events drop constraint if exists item_lifecycle_events_actor_type_check;
alter table public.item_lifecycle_events add constraint item_lifecycle_events_actor_type_check
  check (actor_type = any (array['user', 'admin', 'system']));
alter table public.analytics_audit_events drop constraint if exists analytics_audit_events_scope_check;
alter table public.analytics_audit_events add constraint analytics_audit_events_scope_check
  check (scope = any (array['user', 'admin']));

-- 6. Organization / B2B functions (all SECURITY DEFINER — none may survive
--    as a hidden access path).
drop function if exists public.accept_organization_invitation(uuid);
drop function if exists public.admin_approve_organization(uuid, text);
drop function if exists public.admin_assign_business_plan(uuid, uuid, text, text, boolean, jsonb, numeric);
drop function if exists public.admin_reactivate_organization(uuid, text);
drop function if exists public.admin_suspend_organization(uuid, text);
drop function if exists public.admin_force_transfer_ownership(uuid, text, text);
drop function if exists public.approve_organization_post(uuid);
drop function if exists public.archive_branch(uuid, uuid);
drop function if exists public.archive_organization(uuid);
drop function if exists public.can_access_business_reports(uuid);
drop function if exists public.can_add_staff(uuid);
drop function if exists public.can_create_branch(uuid);
drop function if exists public.can_use_advanced_analytics(uuid);
drop function if exists public.can_use_ai_matching(uuid);
drop function if exists public.cancel_organization_subscription(uuid);
drop function if exists public.change_member_branch(uuid, uuid, uuid);
drop function if exists public.change_member_role(uuid, uuid, text, uuid);
drop function if exists public.create_branch(uuid, text, text, text);
drop function if exists public.create_organization(text, text);
drop function if exists public.create_organization_found_item(uuid, uuid, text, text, text, date, text, text, text, text[]);
drop function if exists public.enforce_organization_review_status();
drop function if exists public.expire_stale_invitations();
drop function if exists public.get_compatible_organizations(text, text);
drop function if exists public.get_my_invitations();
drop function if exists public.get_my_org_review_notifications(integer);
drop function if exists public.get_my_org_review_results(integer);
drop function if exists public.get_my_org_role(uuid, uuid);
drop function if exists public.get_my_organizations();
drop function if exists public.get_org_branches(uuid);
drop function if exists public.get_org_invitations(uuid);
drop function if exists public.get_org_members(uuid);
drop function if exists public.get_organization(uuid);
drop function if exists public.get_organization_analytics_summary(uuid, uuid, integer);
drop function if exists public.get_organization_branches_for_picker(uuid, text);
drop function if exists public.get_organization_business_plan(uuid);
drop function if exists public.get_organization_limit_status(uuid);
drop function if exists public.get_organization_review_queue(uuid, uuid);
drop function if exists public.get_organization_usage(uuid);
drop function if exists public.has_org_item_access(uuid, uuid);
drop function if exists public.has_organization_feature(uuid, text);
drop function if exists public.invite_organization_member(uuid, text, text, uuid);
drop function if exists public.leave_organization(uuid);
drop function if exists public.reject_organization_invitation(uuid);
drop function if exists public.reject_organization_post(uuid, text);
drop function if exists public.remove_organization_member(uuid, uuid);
drop function if exists public.revoke_invitation(uuid);
drop function if exists public.transfer_organization_ownership(uuid, text);
drop function if exists public.update_branch(uuid, text, text, text);

-- 7. Organization / B2B / B2G tables, children first (no CASCADE, so an
--    unexpected dependency fails loudly instead of silently dropping it).
alter table public.organizations drop constraint if exists organizations_default_branch_fkey;
drop table if exists public.organization_subscription_events;
drop table if exists public.organization_subscriptions;
drop table if exists public.organization_invitations;
drop table if exists public.organization_members;
drop table if exists public.organization_branches;
drop table if exists public.organizations;
drop table if exists public.organization_category_compatibility;
drop table if exists public.business_plan_limits;
drop table if exists public.business_plan_prices;
drop table if exists public.business_plans;
