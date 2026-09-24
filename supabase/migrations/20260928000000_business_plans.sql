-- ============================================================================
-- Phase 7 — JUYO for Business: plan/subscription/entitlement architecture,
-- with the OFFICIAL initial pricing (a product decision, not a placeholder):
--   Free:         0 TJS / 0 TJS      (monthly / annual)
--   Business:     299 TJS / 2,990 TJS
--   Business Pro: 699 TJS / 6,990 TJS
--   Enterprise:   custom (no fixed public price, ever)
-- Annual is its own stored number in every case — never computed from
-- monthly at read time.
--
-- COMPLETELY SEPARATE from personal VIP/VVIP (vip_plans/subscriptions/
-- vip_tier_benefits, Phase 6) — no table here is shared or reused. Personal
-- subscriptions stay USER -> VIP/VVIP (prices unchanged: VIP 25/40/50 TJS,
-- VVIP 500/800/1000 TJS for 5/10/30 days); this migration is
-- ORGANIZATION -> BUSINESS PLAN. Verified: nothing in this migration
-- touches vip_plans, vip_tier_benefits, subscriptions, subscription_events,
-- or payment_events.
--
-- No payment provider is integrated (per instruction). `payment_provider`/
-- `payment_reference` on organization_subscriptions are nullable, unused
-- columns reserved for a future approved phase — exactly the same
-- "scaffold, not implementation" reasoning as Phase 6's payment_events.
--
-- Deliberately NOT built (avoiding overbuild, per instruction):
--   - no organization_usage TABLE — usage is computed live via COUNT
--     queries against tables that actually exist (organization_members,
--     organization_branches). Persisting a duplicate counter for data
--     that's already a cheap live COUNT would only risk drift, not add
--     value, at this scale.
--   - no metering for max_active_items/AI-call-volume/storage/
--     notifications/reports-generated — none of these have organization
--     attribution yet (org-owned items are Phase 7C, not yet built). Their
--     LIMITS are real, officially-priced, seeded data (max_active_items:
--     50/500/2000/unlimited); only the enforcement call site (something
--     that creates an org-owned item) doesn't exist yet. The boolean
--     feature flags (ai_matching/advanced_ai/basic_analytics/
--     advanced_analytics/reports/priority_support) ARE fully enforced
--     today via has_organization_feature().
--   - no price-effective-dating machinery — one active price per
--     (plan, billing_interval) at a time, same simple model as vip_plans.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- business_plans — the catalog. No prices/limits live on this row itself
-- (separate tables below), so changing a price or a limit is a data
-- update, never a code change or a redeploy.
-- ----------------------------------------------------------------------------
create table public.business_plans (
  id         uuid primary key default gen_random_uuid(),
  tier       text not null unique check (tier in ('free', 'business', 'business_pro', 'enterprise')),
  name       text not null,
  -- Enterprise is negotiated, not a fixed public price — is_custom marks
  -- this at the PLAN level; a subscription can also independently be
  -- is_custom (see organization_subscriptions) for a one-off negotiated
  -- deal even on a normally-fixed plan, though in practice only Enterprise
  -- is expected to use it.
  is_custom  boolean not null default false,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.business_plans (tier, name, is_custom) values
  ('free', 'Free', false),
  ('business', 'Business', false),
  ('business_pro', 'Business Pro', false),
  ('enterprise', 'Enterprise', true);

alter table public.business_plans enable row level security;
create policy business_plans_public_read on public.business_plans
  for select to anon, authenticated using (is_active = true);

-- ----------------------------------------------------------------------------
-- business_plan_prices — price_amount is NULL for a custom/enterprise
-- price (negotiated, not listed). One active price per (plan, interval).
-- ----------------------------------------------------------------------------
create table public.business_plan_prices (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references public.business_plans(id) on delete cascade,
  billing_interval text not null check (billing_interval in ('monthly', 'annual', 'custom')),
  price_amount    numeric(10,2),
  currency        text not null default 'TJS',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create unique index idx_business_plan_prices_one_active
  on public.business_plan_prices(plan_id, billing_interval) where is_active = true;

-- Seed: OFFICIAL initial JUYO for Business pricing (product decision, not
-- an example) — TJS, stored as numeric(10,2), never floating point.
-- Annual is its own stored number, NEVER computed from monthly (explicit
-- instruction — annual is not monthly*12 with a discount formula).
--   Free:         0 / 0
--   Business:     299 / 2990
--   Business Pro: 699 / 6990
--   Enterprise:   custom, no fixed public price (amount stays null)
insert into public.business_plan_prices (plan_id, billing_interval, price_amount)
select id, 'monthly', 0 from public.business_plans where tier = 'free'
union all
select id, 'annual', 0 from public.business_plans where tier = 'free'
union all
select id, 'monthly', 299 from public.business_plans where tier = 'business'
union all
select id, 'annual', 2990 from public.business_plans where tier = 'business'
union all
select id, 'monthly', 699 from public.business_plans where tier = 'business_pro'
union all
select id, 'annual', 6990 from public.business_plans where tier = 'business_pro'
union all
select id, 'custom', null from public.business_plans where tier = 'enterprise';

alter table public.business_plan_prices enable row level security;
create policy business_plan_prices_public_read on public.business_plan_prices
  for select to anon, authenticated using (is_active = true);

-- ----------------------------------------------------------------------------
-- business_plan_limits — key/value so new limit dimensions never require a
-- schema change, only a new row. NULL limit_value = unlimited.
-- ----------------------------------------------------------------------------
-- limit_key covers two shapes with the same key/value column, deliberately
-- (avoids a second table for what's still just "a named number per plan"):
--   NUMERIC CAPS (max_branches/max_staff/max_active_items) — limit_value is
--     the cap; null = unlimited.
--   FEATURE FLAGS (ai_matching/advanced_ai/basic_analytics/
--     advanced_analytics/reports/priority_support) — limit_value is 1
--     (enabled) or 0 (disabled); never null for these (a feature is either
--     on or off, "unlimited" has no meaning here).
create table public.business_plan_limits (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.business_plans(id) on delete cascade,
  limit_key   text not null check (limit_key in (
                 'max_branches', 'max_staff', 'max_active_items',
                 'ai_matching', 'advanced_ai', 'basic_analytics',
                 'advanced_analytics', 'reports', 'priority_support'
               )),
  limit_value bigint, -- null = unlimited (numeric caps only)
  created_at  timestamptz not null default now(),
  unique (plan_id, limit_key)
);

-- Seed: OFFICIAL initial JUYO for Business limits (product decision).
-- max_active_items/the feature flags are stored here as real data even
-- though nothing enforces max_active_items yet (organization-owned items
-- are Phase 7C, not built) — get_organization_business_plan already
-- resolves and returns this key correctly today; only the enforcement
-- call site (an org-item-creation RPC) doesn't exist yet.
insert into public.business_plan_limits (plan_id, limit_key, limit_value)
select id, k, v from public.business_plans, (values
  ('max_branches', 1), ('max_staff', 3), ('max_active_items', 50),
  ('ai_matching', 1), ('advanced_ai', 0), ('basic_analytics', 0),
  ('advanced_analytics', 0), ('reports', 0), ('priority_support', 0)
) as t(k, v)
where tier = 'free'
union all
select id, k, v from public.business_plans, (values
  ('max_branches', 3), ('max_staff', 10), ('max_active_items', 500),
  ('ai_matching', 1), ('advanced_ai', 0), ('basic_analytics', 1),
  ('advanced_analytics', 0), ('reports', 0), ('priority_support', 0)
) as t(k, v)
where tier = 'business'
union all
select id, k, v from public.business_plans, (values
  ('max_branches', 10), ('max_staff', 30), ('max_active_items', 2000),
  ('ai_matching', 1), ('advanced_ai', 1), ('basic_analytics', 1),
  ('advanced_analytics', 1), ('reports', 1), ('priority_support', 1)
) as t(k, v)
where tier = 'business_pro'
union all
-- Enterprise: numeric caps null (unlimited by default plan — a specific
-- deal can still be tightened via organization_subscriptions.custom_limits
-- on is_custom=true), all feature flags on.
select id, k, v from public.business_plans, (values
  ('max_branches', null), ('max_staff', null), ('max_active_items', null),
  ('ai_matching', 1), ('advanced_ai', 1), ('basic_analytics', 1),
  ('advanced_analytics', 1), ('reports', 1), ('priority_support', 1)
) as t(k, v)
where tier = 'enterprise';

alter table public.business_plan_limits enable row level security;
create policy business_plan_limits_public_read on public.business_plan_limits
  for select to anon, authenticated using (true);

-- ----------------------------------------------------------------------------
-- organization_subscriptions — the tenant is the ORGANIZATION, never a
-- user. One "current" (non-terminal-status) row per org at a time,
-- enforced by the partial unique index below — mirrors, but does not
-- share any table with, the personal `subscriptions` (Phase 6) shape.
-- ----------------------------------------------------------------------------
create table public.organization_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  plan_id          uuid not null references public.business_plans(id),
  billing_interval text not null check (billing_interval in ('monthly', 'annual', 'custom')),
  status           text not null default 'pending' check (status in (
                      'pending', 'trialing', 'active', 'past_due', 'cancelled', 'expired', 'suspended'
                    )),
  -- Snapshotted at creation (same reasoning as personal subscriptions'
  -- price_tjs snapshot) — historical rows stay meaningful even if
  -- business_plan_prices changes later. Null for a plan with no fixed
  -- price yet (Business/Business Pro today) or a custom Enterprise deal.
  price_amount     numeric(10,2),
  currency         text not null default 'TJS',
  -- Enterprise (or a one-off negotiated deal on any plan) — when true,
  -- custom_limits OVERRIDES business_plan_limits entirely for this org
  -- (see get_organization_business_plan). Never client-settable (no RPC
  -- lets a non-admin set is_custom/custom_limits).
  is_custom        boolean not null default false,
  custom_limits    jsonb,
  trial_ends_at    timestamptz,
  starts_at        timestamptz,
  ends_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  cancelled_at     timestamptz,
  cancel_reason    text,
  -- Reserved for a future approved payment-provider phase — never read or
  -- written by anything in this migration.
  payment_provider text,
  payment_reference text
);
create index idx_org_subscriptions_org on public.organization_subscriptions(organization_id);
create index idx_org_subscriptions_status on public.organization_subscriptions(status);
create unique index idx_org_subscriptions_one_current
  on public.organization_subscriptions(organization_id)
  where status in ('pending', 'trialing', 'active', 'past_due', 'suspended');

alter table public.organization_subscriptions enable row level security;
-- Zero client policies — RPC-only, same convention as organization_members
-- and the personal `subscriptions` table.

create table public.organization_subscription_events (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.organization_subscriptions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type      text not null check (event_type in (
                     'created', 'trial_started', 'trial_ended', 'activated', 'renewed',
                     'upgraded', 'downgraded', 'cancelled', 'expired', 'suspended', 'reactivated'
                   )),
  actor_type      text not null check (actor_type in ('user', 'admin', 'system')),
  actor_id        text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index idx_org_subscription_events_sub on public.organization_subscription_events(subscription_id);
alter table public.organization_subscription_events enable row level security;
-- Zero client policies — RPC-only.

-- ============================================================================
-- get_organization_business_plan — the single source of truth for "what
-- can this organization currently do." Resolves the org's current
-- subscription + plan + effective limits (custom_limits override when
-- is_custom, else business_plan_limits). Member-only read.
-- ============================================================================
create or replace function public.get_organization_business_plan(p_organization_id uuid)
returns table (
  subscription_id uuid,
  plan_tier text,
  plan_name text,
  billing_interval text,
  status text,
  is_custom boolean,
  trial_ends_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  limits jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(public.get_my_org_role(p_organization_id), '') = '' then
    raise exception 'Not authorized';
  end if;

  return query
  select
    s.id, bp.tier, bp.name, s.billing_interval, s.status, s.is_custom,
    s.trial_ends_at, s.starts_at, s.ends_at,
    case
      when s.is_custom then coalesce(s.custom_limits, '{}'::jsonb)
      else coalesce(
        (select jsonb_object_agg(l.limit_key, l.limit_value) from public.business_plan_limits l where l.plan_id = bp.id),
        '{}'::jsonb
      )
    end
  from public.organization_subscriptions s
  join public.business_plans bp on bp.id = s.plan_id
  where s.organization_id = p_organization_id
    and s.status in ('pending', 'trialing', 'active', 'past_due', 'suspended')
  order by s.created_at desc
  limit 1;
end;
$$;

grant execute on function public.get_organization_business_plan(uuid) to authenticated;

-- ============================================================================
-- get_organization_usage — live COUNTs, not a stored/metered table (see
-- header comment). Member-only read.
-- ============================================================================
create or replace function public.get_organization_usage(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_branches int;
  v_staff int;
begin
  if coalesce(public.get_my_org_role(p_organization_id), '') = '' then
    raise exception 'Not authorized';
  end if;

  select count(*) into v_branches from public.organization_branches
  where organization_id = p_organization_id and status = 'active';

  select count(*) into v_staff from public.organization_members
  where organization_id = p_organization_id and status = 'active';

  -- Keys here are USAGE counts, deliberately named 'branches'/'staff' (not
  -- 'max_branches'/'max_staff', which are LIMIT keys in business_plan_limits
  -- — same word, different table, kept visually distinct to avoid mixing
  -- up "how many you have" with "how many you're allowed"). active_items
  -- and the AI/analytics/reports feature flags are omitted entirely (not
  -- zeroed) — active-item counting has no organization attribution yet
  -- (Phase 7C+), and feature flags aren't "usage" at all.
  return jsonb_build_object('branches', v_branches, 'staff', v_staff);
end;
$$;

grant execute on function public.get_organization_usage(uuid) to authenticated;

-- ============================================================================
-- Entitlement checks — the centralized surface every future call site
-- should use instead of scattering `if plan === 'business'` throughout the
-- codebase. can_create_branch/can_add_staff are REAL and enforced (wired
-- into create_branch/accept_organization_invitation below). can_use_
-- ai_matching/can_use_advanced_analytics/can_access_business_reports are
-- ALSO real, backed by the official seeded feature flags (see
-- has_organization_feature further down). Only can_create_item stays a
-- documented `true` stub — org-owned items don't exist yet (Phase 7C).
-- ============================================================================
create or replace function public.can_create_branch(p_organization_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit bigint;
  v_current int;
begin
  select (limits->>'max_branches')::bigint into v_limit
  from public.get_organization_business_plan(p_organization_id);
  if v_limit is null then
    return true; -- unlimited, or no active subscription row resolved (organization has no plan — fails elsewhere, not here)
  end if;

  select count(*) into v_current from public.organization_branches
  where organization_id = p_organization_id and status = 'active';

  return v_current < v_limit;
end;
$$;

grant execute on function public.can_create_branch(uuid) to authenticated;

create or replace function public.can_add_staff(p_organization_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit bigint;
  v_current int;
begin
  select (limits->>'max_staff')::bigint into v_limit
  from public.get_organization_business_plan(p_organization_id);
  if v_limit is null then
    return true;
  end if;

  select count(*) into v_current from public.organization_members
  where organization_id = p_organization_id and status = 'active';

  return v_current < v_limit;
end;
$$;

grant execute on function public.can_add_staff(uuid) to authenticated;

-- ============================================================================
-- get_organization_limit_status — downgrade safety (section 11): if a
-- downgrade leaves an organization ABOVE its new numeric caps, existing
-- data is never touched or deleted (nothing in this migration ever
-- deletes organization_branches/organization_members rows for this
-- reason) — this RPC is what "clearly exposes the exceeded limit state"
-- so a future UI can show it. `exceeded` is computed live from the same
-- usage/limit sources can_create_branch/can_add_staff already use, so it
-- can never drift from what those functions actually enforce.
-- ============================================================================
create or replace function public.get_organization_limit_status(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limits jsonb;
  v_usage jsonb;
  v_branch_limit bigint;
  v_staff_limit bigint;
  v_branch_usage int;
  v_staff_usage int;
begin
  if coalesce(public.get_my_org_role(p_organization_id), '') = '' then
    raise exception 'Not authorized';
  end if;

  select limits into v_limits from public.get_organization_business_plan(p_organization_id);
  v_usage := public.get_organization_usage(p_organization_id);

  v_branch_limit := (v_limits->>'max_branches')::bigint;
  v_staff_limit := (v_limits->>'max_staff')::bigint;
  v_branch_usage := (v_usage->>'branches')::int;
  v_staff_usage := (v_usage->>'staff')::int;

  return jsonb_build_object(
    'max_branches', jsonb_build_object(
      'limit', v_branch_limit, 'usage', v_branch_usage,
      'exceeded', v_branch_limit is not null and v_branch_usage > v_branch_limit
    ),
    'max_staff', jsonb_build_object(
      'limit', v_staff_limit, 'usage', v_staff_usage,
      'exceeded', v_staff_limit is not null and v_staff_usage > v_staff_limit
    )
  );
end;
$$;

grant execute on function public.get_organization_limit_status(uuid) to authenticated;

-- has_organization_feature — the generic primitive behind every boolean
-- entitlement (ai_matching/advanced_ai/basic_analytics/advanced_analytics/
-- reports/priority_support). New future flags need only a new
-- business_plan_limits row + a call to this function, never a new RPC.
create or replace function public.has_organization_feature(p_organization_id uuid, p_feature_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value bigint;
begin
  if coalesce(public.get_my_org_role(p_organization_id), '') = '' then
    raise exception 'Not authorized';
  end if;

  select (limits->>p_feature_key)::bigint into v_value
  from public.get_organization_business_plan(p_organization_id);

  return coalesce(v_value, 0) > 0;
end;
$$;

grant execute on function public.has_organization_feature(uuid, text) to authenticated;

-- Not yet enforceable (no organization-owned items — item attribution is
-- Phase 7C, not built) — always true, by design, until there's a real
-- item count to check against max_active_items. Documented, not silently
-- faked; the plan LIMIT itself (max_active_items) is already real, seeded
-- data — only this enforcement call site is pending.
create or replace function public.can_create_item(p_organization_id uuid) returns boolean
language sql stable security definer set search_path = public as $$ select true; $$;

-- These three ARE real, backed by the official seeded feature flags.
create or replace function public.can_use_ai_matching(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select public.has_organization_feature(p_organization_id, 'ai_matching'); $$;

create or replace function public.can_use_advanced_analytics(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select public.has_organization_feature(p_organization_id, 'advanced_analytics'); $$;

create or replace function public.can_access_business_reports(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select public.has_organization_feature(p_organization_id, 'reports'); $$;

grant execute on function public.can_create_item(uuid) to authenticated;
grant execute on function public.can_use_ai_matching(uuid) to authenticated;
grant execute on function public.can_use_advanced_analytics(uuid) to authenticated;
grant execute on function public.can_access_business_reports(uuid) to authenticated;

-- ============================================================================
-- cancel_organization_subscription — owner-only self-service, mirrors the
-- personal cancel_subscription (Phase 6) shape: status leaves the "current"
-- set immediately (removing the benefit right away), the original
-- starts_at/ends_at stay untouched as a historical fact of what was
-- purchased. No refund/credit logic — same explicit non-scope as Phase 6.
-- ============================================================================
create or replace function public.cancel_organization_subscription(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.get_my_org_role(p_organization_id);
  v_sub_id uuid;
begin
  if coalesce(v_role, '') <> 'owner' then
    raise exception 'Only the owner can cancel the business subscription';
  end if;

  select id into v_sub_id from public.organization_subscriptions
  where organization_id = p_organization_id
    and status in ('pending', 'trialing', 'active', 'past_due', 'suspended')
  order by created_at desc limit 1;
  if v_sub_id is null then
    raise exception 'No active subscription to cancel';
  end if;

  update public.organization_subscriptions
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = v_sub_id;

  insert into public.organization_subscription_events (subscription_id, organization_id, event_type, actor_type, actor_id)
  values (v_sub_id, p_organization_id, 'cancelled', 'user', get_auth_id());
end;
$$;

grant execute on function public.cancel_organization_subscription(uuid) to authenticated;

-- ============================================================================
-- admin_assign_business_plan — the ONLY way an organization's plan
-- actually changes to something paid (Business/Business Pro/Enterprise).
-- No payment provider exists yet, so this is a manual admin action
-- (identical reasoning to admin_activate_subscription, Phase 6) — a
-- trusted server-side event is what moves a subscription, never a client
-- flag. Supersedes any other "current" subscription for the org (same
-- simple non-stacking renewal/upgrade rule as Phase 6, documented there
-- and repeated here for consistency).
-- ============================================================================
create or replace function public.admin_assign_business_plan(
  p_organization_id uuid,
  p_plan_id uuid,
  p_billing_interval text,
  p_admin_id text,
  p_is_custom boolean default false,
  p_custom_limits jsonb default null,
  p_price_amount numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_sub record;
  v_new_sub_id uuid;
begin
  if p_billing_interval not in ('monthly', 'annual', 'custom') then
    raise exception 'Invalid billing interval';
  end if;
  if not exists (select 1 from public.business_plans where id = p_plan_id and is_active = true) then
    raise exception 'Unknown or inactive plan';
  end if;

  for v_old_sub in
    select id from public.organization_subscriptions
    where organization_id = p_organization_id
      and status in ('pending', 'trialing', 'active', 'past_due', 'suspended')
  loop
    update public.organization_subscriptions set status = 'expired', updated_at = now() where id = v_old_sub.id;
    insert into public.organization_subscription_events (subscription_id, organization_id, event_type, actor_type, actor_id, metadata)
    values (v_old_sub.id, p_organization_id, 'expired', 'system', p_admin_id, jsonb_build_object('reason', 'superseded'));
  end loop;

  insert into public.organization_subscriptions (
    organization_id, plan_id, billing_interval, status, price_amount, is_custom, custom_limits, starts_at
  )
  values (
    p_organization_id, p_plan_id, p_billing_interval, 'active', p_price_amount, p_is_custom, p_custom_limits, now()
  )
  returning id into v_new_sub_id;

  insert into public.organization_subscription_events (subscription_id, organization_id, event_type, actor_type, actor_id)
  values (v_new_sub_id, p_organization_id, 'activated', 'admin', p_admin_id);

  return v_new_sub_id;
end;
$$;

revoke execute on function public.admin_assign_business_plan(uuid, uuid, text, text, boolean, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.admin_assign_business_plan(uuid, uuid, text, text, boolean, jsonb, numeric) to service_role;

-- ============================================================================
-- create_organization (REPLACED) — every organization now also gets a
-- Free business subscription at creation, so "no subscription" is never a
-- state any organization can be in (simplifies every entitlement check:
-- there is always a current plan to resolve). Same signature as 7A —
-- create/replace is a true drop-in here, no client-facing change.
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
  v_free_plan_id uuid;
  v_sub_id uuid;
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

  select id into v_free_plan_id from public.business_plans where tier = 'free';
  insert into public.organization_subscriptions (organization_id, plan_id, billing_interval, status, price_amount, starts_at)
  values (v_org_id, v_free_plan_id, 'monthly', 'active', 0, now())
  returning id into v_sub_id;

  insert into public.organization_subscription_events (subscription_id, organization_id, event_type, actor_type, actor_id)
  values (v_sub_id, v_org_id, 'created', 'system', v_user_id);

  return v_org_id;
end;
$$;

-- ============================================================================
-- create_branch (REPLACED) — now enforces the plan's branch limit before
-- creating. Same signature as 7A/7B — drop-in.
-- ============================================================================
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
  if not public.can_create_branch(p_organization_id) then
    raise exception 'Branch limit reached for the current plan';
  end if;

  insert into public.organization_branches (organization_id, name, city, address)
  values (p_organization_id, trim(p_name), p_city, p_address)
  returning id into v_branch_id;

  return v_branch_id;
end;
$$;

-- ============================================================================
-- accept_organization_invitation (REPLACED) — now enforces the plan's
-- staff limit at the moment membership is actually created (not at invite
-- time, since the limit may change between invite and accept). Same
-- signature as 7B — drop-in.
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

  if not public.can_add_staff(v_org_id) then
    raise exception 'Staff limit reached for the current plan';
  end if;

  insert into public.organization_members (organization_id, branch_id, user_id, role)
  values (v_org_id, v_branch_id, v_user_id, v_role);
end;
$$;

-- ============================================================================
-- Rollback (not executed — reference only):
--
-- create or replace function public.accept_organization_invitation(uuid) ... -- (revert to the 7B body, without the can_add_staff check)
-- create or replace function public.create_branch(uuid, text, text, text) ... -- (revert to the 7B body, without the can_create_branch check)
-- create or replace function public.create_organization(text, text) ... -- (revert to the 7A body, without the free-subscription insert)
-- drop function if exists public.admin_assign_business_plan(uuid, uuid, text, text, boolean, jsonb, numeric);
-- drop function if exists public.cancel_organization_subscription(uuid);
-- drop function if exists public.can_access_business_reports(uuid);
-- drop function if exists public.can_use_advanced_analytics(uuid);
-- drop function if exists public.can_use_ai_matching(uuid);
-- drop function if exists public.can_create_item(uuid);
-- drop function if exists public.has_organization_feature(uuid, text);
-- drop function if exists public.get_organization_limit_status(uuid);
-- drop function if exists public.can_add_staff(uuid);
-- drop function if exists public.can_create_branch(uuid);
-- drop function if exists public.get_organization_usage(uuid);
-- drop function if exists public.get_organization_business_plan(uuid);
-- drop table if exists public.organization_subscription_events;
-- drop table if exists public.organization_subscriptions;
-- drop table if exists public.business_plan_limits;
-- drop table if exists public.business_plan_prices;
-- drop table if exists public.business_plans;
-- ============================================================================
