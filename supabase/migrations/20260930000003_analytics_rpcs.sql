-- ============================================================================
-- Phase 9B/9C/9D — Analytics RPCs: user, organization/branch, platform
-- admin. Builds additively on 20260930000002 (item_lifecycle_events +
-- indexes) — none of those are altered.
--
-- Every RPC below derives its own authorization scope server-side
-- (get_auth_id() / get_my_org_role() / service_role) — no RPC accepts a
-- client-supplied "which user/org/role to show" parameter as anything
-- other than "which org to check MY membership against."
-- ============================================================================

-- ============================================================================
-- USER — get_my_analytics_summary. Strictly the caller's own rows.
-- ============================================================================
create or replace function public.get_my_analytics_summary(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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
    'resolvedPosts', count(*) filter (where is_resolved),
    'organizationAttachedPosts', count(*) filter (where organization_id is not null)
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

grant execute on function public.get_my_analytics_summary(int) to authenticated;

-- ============================================================================
-- ORGANIZATION / BRANCH — get_organization_analytics_summary.
--
-- Entitlement note (explicit product-decision reconciliation): the
-- already-seeded business_plan_limits (20260928000000) gives Free tier
-- basic_analytics=0 — i.e. Free has NO analytics feature flag at all. The
-- Phase 9 product decision that "Free gets basic counts" is honored
-- WITHOUT contradicting that seeded flag: three trivial totals
-- (totalPosts/lostPosts/foundPosts) are always computed regardless of
-- entitlement (they cost nothing extra and match "basic counts"), but
-- every breakdown/trend/range-filtered figure requires has_organization_feature
-- ('basic_analytics') at minimum, and branch-detail + custom range +
-- export require ('advanced_analytics') — using the EXISTING entitlement
-- primitive (has_organization_feature) rather than inventing a new one.
-- ============================================================================
create or replace function public.get_organization_analytics_summary(
  p_organization_id uuid, p_branch_id uuid default null, p_days int default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_my_branch uuid;
  v_scope_branch uuid;
  v_has_basic boolean;
  v_has_advanced boolean;
  v_max_days int;
  v_since timestamptz;
  v_result jsonb;
begin
  select role, branch_id into v_role, v_my_branch
  from public.organization_members
  where organization_id = p_organization_id and user_id = get_auth_id() and status = 'active'
  order by case role when 'owner' then 5 when 'admin' then 4 when 'branch_manager' then 3 when 'staff' then 2 else 1 end desc
  limit 1;

  if coalesce(v_role, '') = '' then
    raise exception 'Not authorized';
  end if;

  -- Branch scoping: an org-wide role (owner/admin) may request any branch
  -- of THIS organization (or none, for org-wide); a branch-scoped role
  -- (branch_manager/staff/viewer) is always forced to their own assigned
  -- branch, regardless of what p_branch_id the client sent — this is the
  -- exact same rule has_org_item_access already enforces for item
  -- visibility, applied here to analytics instead.
  if v_role in ('owner', 'admin') then
    v_scope_branch := p_branch_id;
  else
    -- Defense in depth: organization_members.branch_id has no DB-level
    -- CHECK tying it to role (see 20260926000000's comment on that
    -- column — it's an RPC-enforced invariant, not a hard guarantee). If
    -- a branch-scoped role's branch_id were ever null, treating that as
    -- "org-wide" here would leak data — raise instead of silently
    -- widening scope.
    if v_my_branch is null then
      raise exception 'Branch-scoped role has no assigned branch';
    end if;
    v_scope_branch := v_my_branch;
  end if;

  v_has_basic := public.has_organization_feature(p_organization_id, 'basic_analytics');
  v_has_advanced := public.has_organization_feature(p_organization_id, 'advanced_analytics');
  v_max_days := case when v_has_advanced then 90 when v_has_basic then 30 else 0 end;

  -- Always-available baseline (see entitlement note above).
  select jsonb_build_object(
    'totalPosts', count(*),
    'lostPosts', count(*) filter (where type = 'lost'),
    'foundPosts', count(*) filter (where type = 'found')
  )
  into v_result
  from public.items
  where organization_id = p_organization_id
    and (v_scope_branch is null or branch_id = v_scope_branch);

  v_result := v_result || jsonb_build_object('entitlement', jsonb_build_object(
    'basicAnalytics', v_has_basic, 'advancedAnalytics', v_has_advanced, 'maxDays', v_max_days,
    'canExport', v_has_advanced, 'branchDetailAllowed', v_has_advanced
  ));

  if not v_has_basic then
    -- Free tier — stop here. The client shows an upgrade prompt for
    -- everything else; no breakdown/trend query is even run.
    return v_result;
  end if;

  p_days := least(coalesce(p_days, v_max_days), v_max_days);
  v_since := now() - make_interval(days => p_days);

  select v_result || jsonb_build_object(
    'organizationOwnedFoundPosts', count(*) filter (where user_id is null),
    'organizationAssociatedPosts', count(*) filter (where user_id is not null),
    'pendingReviews', count(*) filter (where organization_review_status = 'pending'),
    'approvedReviews', count(*) filter (where organization_review_status = 'approved'),
    'rejectedReviews', count(*) filter (where organization_review_status = 'rejected'),
    'activeItems', count(*) filter (where coalesce(status, 'active') = 'active' and not is_resolved),
    'resolvedItems', count(*) filter (where is_resolved),
    'staffCreatedItems', count(*) filter (where created_by_staff_id is not null)
  )
  into v_result
  from public.items
  where organization_id = p_organization_id
    and (v_scope_branch is null or branch_id = v_scope_branch)
    and created_at >= v_since;

  -- KNOWN LIMITATION (flagged in the final report, not silently glossed
  -- over): item_lifecycle_events' 'expired'/'deleted' rows don't retain
  -- organization_id/branch_id (deliberately minimal metadata — see
  -- 20260930000002), so an org's expired/deleted counts can only include
  -- items still traceable via the live `items` table at query time. An
  -- item that was BOTH organization-owned AND already hard-deleted cannot
  -- be attributed back to its organization after the fact with the
  -- current event schema.
  select v_result || jsonb_build_object(
    'expiredItems', count(*) filter (where e.event_type = 'expired'),
    'deletedItems', count(*) filter (where e.event_type = 'deleted')
  )
  into v_result
  from public.item_lifecycle_events e
  where e.created_at >= v_since
    and e.item_id in (
      select id from public.items
      where organization_id = p_organization_id and (v_scope_branch is null or branch_id = v_scope_branch)
    );

  select v_result || jsonb_build_object('itemsByCity', coalesce(jsonb_agg(jsonb_build_object('city', city, 'count', c) order by c desc), '[]'::jsonb))
  into v_result
  from (
    select city, count(*) as c from public.items
    where organization_id = p_organization_id and (v_scope_branch is null or branch_id = v_scope_branch) and created_at >= v_since
    group by city
  ) t;

  select v_result || jsonb_build_object('itemsByCategory', coalesce(jsonb_agg(jsonb_build_object('category', category, 'count', c) order by c desc), '[]'::jsonb))
  into v_result
  from (
    select category, count(*) as c from public.items
    where organization_id = p_organization_id and (v_scope_branch is null or branch_id = v_scope_branch) and created_at >= v_since
    group by category
  ) t;

  -- Branch-detail breakdown — org-wide roles only, and only with
  -- advanced_analytics (Business Pro+), per the explicit Phase 9 tiering.
  if v_scope_branch is null and v_has_advanced then
    select v_result || jsonb_build_object('itemsByBranch', coalesce(jsonb_agg(jsonb_build_object('branchId', b.id, 'branchName', b.name, 'count', coalesce(t.c, 0)) order by coalesce(t.c, 0) desc), '[]'::jsonb))
    into v_result
    from public.organization_branches b
    left join (
      select branch_id, count(*) as c from public.items
      where organization_id = p_organization_id and created_at >= v_since and branch_id is not null
      group by branch_id
    ) t on t.branch_id = b.id
    where b.organization_id = p_organization_id;
  end if;

  -- count(distinct m.id), not count(*) — the OR-join can match a single
  -- match twice (once via lost_item_id, once via found_item_id) when BOTH
  -- sides of a match belong to this same organization (e.g. a personal
  -- LOST post attached to the org matched against the org's own FOUND
  -- post) — a real, if uncommon, case worth getting right, not an
  -- edge case to ignore.
  select v_result || jsonb_build_object('aiMatches', count(distinct m.id))
  into v_result
  from public.item_matches m
  join public.items i on i.id = m.lost_item_id or i.id = m.found_item_id
  where i.organization_id = p_organization_id
    and (v_scope_branch is null or i.branch_id = v_scope_branch)
    and m.created_at >= v_since;

  select v_result || jsonb_build_object('activityTrend', coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d), '[]'::jsonb))
  into v_result
  from (
    select date_trunc('day', created_at)::date as d, count(*) as c
    from public.items
    where organization_id = p_organization_id and (v_scope_branch is null or branch_id = v_scope_branch) and created_at >= v_since
    group by 1
  ) t;

  return v_result;
end;
$$;

grant execute on function public.get_organization_analytics_summary(uuid, uuid, int) to authenticated;

-- ============================================================================
-- PLATFORM ADMIN — admin_get_platform_analytics. service_role-only RPC,
-- called ONLY from an isAdminUser-gated Next.js API route — following the
-- exact convention admin_backfill_ai_matches/admin_assign_business_plan
-- already established (a Postgres RPC has no way to independently verify
-- Clerk-admin status; ADMIN_USER_IDS is a Web-only env var, not DB state).
-- ============================================================================
create or replace function public.admin_get_platform_analytics(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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
    'matchesHigh', count(*) filter (where score >= 80),
    'organizationFoundMatches', count(*) filter (where exists (
      select 1 from public.items i where i.id = m.found_item_id and i.user_id is null
    ))
  )
  into v_result
  from public.item_matches m
  where m.created_at >= v_since;

  select v_result || jsonb_build_object(
    'totalOrganizations', (select count(*) from public.organizations),
    'pendingOrganizations', (select count(*) from public.organizations where status = 'pending'),
    'activeOrganizations', (select count(*) from public.organizations where status = 'active'),
    'suspendedOrganizations', (select count(*) from public.organizations where status = 'suspended'),
    'archivedOrganizations', (select count(*) from public.organizations where status = 'archived'),
    'totalBranches', (select count(*) from public.organization_branches where status = 'active'),
    'totalStaff', (select count(*) from public.organization_members where status = 'active')
  ) into v_result;

  select v_result || jsonb_build_object(
    'totalSubscriptions', count(*),
    'activeSubscriptions', count(*) filter (where os.status = 'active'),
    'subscriptionsByPlan', coalesce((
      select jsonb_object_agg(tier, cnt) from (
        select bp2.tier, count(*) as cnt
        from public.organization_subscriptions os2
        join public.business_plans bp2 on bp2.id = os2.plan_id
        where os2.status in ('active', 'trialing', 'past_due')
        group by bp2.tier
      ) x(tier, cnt)
    ), '{}'::jsonb),
    'subscriptionsByStatus', coalesce((
      select jsonb_object_agg(status, cnt) from (
        select status, count(*) as cnt from public.organization_subscriptions group by status
      ) x(status, cnt)
    ), '{}'::jsonb)
  )
  into v_result
  from public.organization_subscriptions os;

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

revoke execute on function public.admin_get_platform_analytics(int) from public, anon, authenticated;
grant execute on function public.admin_get_platform_analytics(int) to service_role;

-- ============================================================================
-- Rollback (not executed — reference only):
--
-- revoke execute on function public.admin_get_platform_analytics(int) from service_role;
-- drop function if exists public.admin_get_platform_analytics(int);
-- drop function if exists public.get_organization_analytics_summary(uuid, uuid, int);
-- drop function if exists public.get_my_analytics_summary(int);
-- ============================================================================
