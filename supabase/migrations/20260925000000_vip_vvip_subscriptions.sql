-- ============================================================================
-- Phase 6 — VIP / VVIP monetization.
--
-- Payment reality check (documented, not glossed over): no payment provider
-- is integrated in this phase (explicitly out of scope). "Payment
-- confirmation" today means an ADMIN manually confirms a bank transfer/cash
-- payment through the admin panel (admin_activate_subscription, below) —
-- the exact same shape a real payment webhook will call later (a trusted
-- SERVER-SIDE event moves a subscription from pending -> active). The
-- client can never do this itself; there is no "mark my own subscription
-- paid" path anywhere in this migration.
--
-- Server-authoritative, end to end:
--   - price/duration are snapshotted from vip_plans at creation time, never
--     accepted from the client (create_subscription takes ONLY p_plan_id).
--   - status/starts_at/expires_at are set exclusively by
--     admin_activate_subscription / admin_revoke_subscription / the
--     expiry sweep — never by a client write (RLS enabled, zero policies
--     on subscriptions/subscription_events/payment_events, same convention
--     as dismissed_notifications/item_matches).
--   - "is this user's VIP/VVIP actually active right now" is ALWAYS
--     computed live as `status = 'active' and expires_at > now()` —
--     wherever this is checked (get_my_vip_status, search_items' boost
--     join), never from a cached boolean a cron would need to keep in
--     sync. A delayed/missed cron sweep can only ever make the ADMIN-FACING
--     status column stale for display purposes; it can never make an
--     actually-expired subscription look active to a real query.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Catalog — the 6 fixed plans. Prices are final per product decision;
-- duration/price live here, never in client code, so a future price change
-- is a data update, not a redeploy.
-- ----------------------------------------------------------------------------
create table if not exists public.vip_plans (
  id            uuid primary key default gen_random_uuid(),
  tier          text not null check (tier in ('vip', 'vvip')),
  duration_days int not null check (duration_days in (5, 10, 30)),
  price_tjs     numeric(10,2) not null check (price_tjs > 0),
  currency      text not null default 'TJS',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (tier, duration_days)
);

insert into public.vip_plans (tier, duration_days, price_tjs) values
  ('vip',  5,  25.00),
  ('vip',  10, 40.00),
  ('vip',  30, 50.00),
  ('vvip', 5,  500.00),
  ('vvip', 10, 800.00),
  ('vvip', 30, 1000.00)
on conflict (tier, duration_days) do nothing;

-- Plans are public pricing info (a logged-out visitor must be able to see
-- prices on a pricing page) — the one table in this migration with a real
-- SELECT policy rather than RPC-only.
alter table public.vip_plans enable row level security;
drop policy if exists vip_plans_public_read on public.vip_plans;
create policy vip_plans_public_read on public.vip_plans
  for select
  to anon, authenticated
  using (is_active = true);

-- ----------------------------------------------------------------------------
-- Per-tier benefits — decoupled from pricing so a future admin panel can
-- retune benefits without touching vip_plans. feed_boost_hours is read
-- live by search_items (below); VIP and VVIP intentionally differ, not
-- just by badge.
-- ----------------------------------------------------------------------------
create table if not exists public.vip_tier_benefits (
  tier             text primary key check (tier in ('vip', 'vvip')),
  feed_boost_hours int not null default 0 check (feed_boost_hours >= 0),
  updated_at       timestamptz not null default now()
);

insert into public.vip_tier_benefits (tier, feed_boost_hours) values
  ('vip',  24),
  ('vvip', 72)
on conflict (tier) do nothing;

alter table public.vip_tier_benefits enable row level security;
drop policy if exists vip_tier_benefits_public_read on public.vip_tier_benefits;
create policy vip_tier_benefits_public_read on public.vip_tier_benefits
  for select
  to anon, authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- Subscriptions — one row per purchase attempt (not one row per user).
-- tier/duration_days/price_tjs/currency are SNAPSHOTTED from vip_plans at
-- creation so historical rows stay meaningful even if a plan's price
-- changes or is deactivated later.
-- ----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  plan_id        uuid not null references public.vip_plans(id),
  tier           text not null check (tier in ('vip', 'vvip')),
  duration_days  int not null check (duration_days in (5, 10, 30)),
  price_tjs      numeric(10,2) not null,
  currency       text not null default 'TJS',
  status         text not null default 'pending' check (status in ('pending', 'active', 'expired', 'cancelled', 'revoked')),
  starts_at      timestamptz,
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  cancelled_at   timestamptz,
  cancelled_by   text,
  cancel_reason  text
);
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);
-- The hot-path lookup (search_items' boost join, get_my_vip_status): one
-- user's currently-active row(s).
create index if not exists idx_subscriptions_active_user
  on public.subscriptions(user_id, expires_at)
  where status = 'active';

alter table public.subscriptions enable row level security;

create table if not exists public.subscription_events (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  user_id         text not null,
  event_type      text not null check (event_type in (
                     'created', 'payment_confirmed', 'activated', 'renewed',
                     'upgraded', 'expired', 'cancelled', 'revoked'
                   )),
  actor_type      text not null check (actor_type in ('user', 'admin', 'system')),
  actor_id        text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_subscription_events_subscription_id on public.subscription_events(subscription_id);
alter table public.subscription_events enable row level security;

-- Scaffold for a real payment provider later — today every row here is
-- created by admin_activate_subscription with confirmed_by = the admin who
-- manually verified a transfer. `provider`/`external_ref` stay null until
-- an actual provider is approved and wired in; nothing reads them yet.
create table if not exists public.payment_events (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  user_id         text not null,
  provider        text,
  external_ref    text,
  amount_tjs      numeric(10,2) not null,
  status          text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  confirmed_by    text,
  raw_payload     jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_payment_events_subscription_id on public.payment_events(subscription_id);
alter table public.payment_events enable row level security;

-- ============================================================================
-- create_subscription — the ONLY client-callable write on this whole
-- feature. Takes nothing but a plan id; every other field (tier, duration,
-- price, status) is read from vip_plans server-side. Starts 'pending' —
-- no benefit exists yet, matches nothing in the "is active" check below.
-- ============================================================================
create or replace function public.create_subscription(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
  v_plan public.vip_plans%rowtype;
  v_sub_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_plan from public.vip_plans where id = p_plan_id and is_active = true;
  if not found then
    raise exception 'Unknown or inactive plan';
  end if;

  -- Duplicate-prevention: at most one PENDING purchase in flight per user —
  -- stops accidental/spammy repeat submissions. Having a still-active
  -- subscription is explicitly allowed (that's a renewal/upgrade purchase,
  -- handled at activation time, not blocked here).
  if exists (select 1 from public.subscriptions where user_id = v_user_id and status = 'pending') then
    raise exception 'You already have a pending subscription request';
  end if;

  insert into public.subscriptions (user_id, plan_id, tier, duration_days, price_tjs, currency)
  values (v_user_id, v_plan.id, v_plan.tier, v_plan.duration_days, v_plan.price_tjs, v_plan.currency)
  returning id into v_sub_id;

  insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id)
  values (v_sub_id, v_user_id, 'created', 'user', v_user_id);

  return v_sub_id;
end;
$$;

grant execute on function public.create_subscription(uuid) to authenticated;

-- ============================================================================
-- cancel_subscription — the user cancels their OWN pending or active
-- request. Cancelling an active one removes the benefit IMMEDIATELY
-- (status leaves 'active', which is what every "is it active" check keys
-- off of) while leaving the original expires_at untouched as a historical
-- fact of what was purchased. No refund/credit logic — explicitly out of
-- scope per product instruction; flagged in the completion report.
-- ============================================================================
create or replace function public.cancel_subscription(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
  v_sub public.subscriptions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found or v_sub.user_id <> v_user_id then
    raise exception 'Subscription not found';
  end if;
  if v_sub.status not in ('pending', 'active') then
    raise exception 'Subscription cannot be cancelled from its current status';
  end if;

  update public.subscriptions
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_user_id, updated_at = now()
  where id = p_subscription_id;

  insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id)
  values (p_subscription_id, v_user_id, 'cancelled', 'user', v_user_id);
end;
$$;

grant execute on function public.cancel_subscription(uuid) to authenticated;

-- ============================================================================
-- admin_activate_subscription — the manual stand-in for a real payment
-- webhook (see header comment). Locked to service_role: no internal
-- get_auth_id() check would even make sense here (a service-role API call
-- carries no user JWT), so — same reasoning as run_ai_matching_for_item /
-- admin_backfill_ai_matches (Phase 5) — the default PUBLIC execute grant is
-- explicitly revoked. p_admin_id is passed in by the already
-- isAdminUser()-gated Next.js route purely for the audit trail.
--
-- Renewal/upgrade rule (deliberately simple, per product instruction "do
-- not invent complicated credit/refund rules yet"): activating a new
-- subscription always starts a fresh starts_at/expires_at window from now;
-- any OTHER currently-active subscription for the same user is marked
-- 'expired' (reason: superseded) at the same moment, so a user only ever
-- has at most one active row. Unused remaining time on the old
-- subscription is NOT credited/extended — flagged as a product decision to
-- revisit, not a bug.
-- ============================================================================
create or replace function public.admin_activate_subscription(p_subscription_id uuid, p_admin_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_superseded record;
  v_starts timestamptz := now();
  v_expires timestamptz;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'Subscription not found';
  end if;
  if v_sub.status <> 'pending' then
    raise exception 'Only a pending subscription can be activated';
  end if;

  v_expires := v_starts + make_interval(days => v_sub.duration_days);

  for v_superseded in
    select id from public.subscriptions
    where user_id = v_sub.user_id and status = 'active' and id <> p_subscription_id
  loop
    update public.subscriptions set status = 'expired', updated_at = now() where id = v_superseded.id;
    insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id, metadata)
    values (v_superseded.id, v_sub.user_id, 'expired', 'system', p_admin_id, jsonb_build_object('reason', 'superseded'));
  end loop;

  update public.subscriptions
  set status = 'active', starts_at = v_starts, expires_at = v_expires, updated_at = now()
  where id = p_subscription_id;

  insert into public.payment_events (subscription_id, user_id, amount_tjs, status, confirmed_by)
  values (p_subscription_id, v_sub.user_id, v_sub.price_tjs, 'confirmed', p_admin_id);

  insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id)
  values (p_subscription_id, v_sub.user_id, 'payment_confirmed', 'admin', p_admin_id);
  insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id)
  values (p_subscription_id, v_sub.user_id, 'activated', 'admin', p_admin_id);
end;
$$;

revoke execute on function public.admin_activate_subscription(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_activate_subscription(uuid, text) to service_role;

-- ============================================================================
-- admin_revoke_subscription — force-stops an ACTIVE subscription
-- immediately (abuse, chargeback, mistaken activation, etc). Same
-- service_role-only reasoning as admin_activate_subscription.
-- ============================================================================
create or replace function public.admin_revoke_subscription(p_subscription_id uuid, p_admin_id text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.subscriptions%rowtype;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'Subscription not found';
  end if;
  if v_sub.status <> 'active' then
    raise exception 'Only an active subscription can be revoked';
  end if;

  update public.subscriptions
  set status = 'revoked', cancelled_at = now(), cancelled_by = p_admin_id, cancel_reason = p_reason, updated_at = now()
  where id = p_subscription_id;

  insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id, metadata)
  values (p_subscription_id, v_sub.user_id, 'revoked', 'admin', p_admin_id, jsonb_build_object('reason', p_reason));
end;
$$;

revoke execute on function public.admin_revoke_subscription(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_revoke_subscription(uuid, text, text) to service_role;

-- ============================================================================
-- Expiry sweep — HOUSEKEEPING ONLY. Every real "is this active" check
-- (get_my_vip_status, search_items) already computes liveness from
-- status/expires_at directly and NEVER depends on this having run. This
-- exists purely so the admin list and a user's own history read 'expired'
-- promptly instead of showing a stale 'active' row whose time has already
-- passed. Scheduled via pg_cron, same mechanism as cleanup-expired-posts
-- (docs/engineering/07-backend-rules.md).
-- ============================================================================
create or replace function public.expire_stale_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.subscriptions
    set status = 'expired', updated_at = now()
    where status = 'active' and expires_at <= now()
    returning id, user_id
  )
  insert into public.subscription_events (subscription_id, user_id, event_type, actor_type)
  select id, user_id, 'expired', 'system' from expired;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expire_stale_subscriptions() from public, anon, authenticated;
grant execute on function public.expire_stale_subscriptions() to service_role;

-- cron.schedule(job_name, ...) is an upsert-by-name — safe to run again on
-- a future migration replay without creating a duplicate job.
select cron.schedule(
  'expire-stale-subscriptions',
  '*/15 * * * *',
  $$select public.expire_stale_subscriptions();$$
);

-- ============================================================================
-- Reads.
-- ============================================================================

-- The caller's live tier, computed the same way every other check computes
-- it (never a cached column) — this is what gates any future client-side
-- "you are VIP" UI state.
create or replace function public.get_my_vip_status()
returns table (tier text, expires_at timestamptz, subscription_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
begin
  if v_user_id is null then
    return;
  end if;

  return query
  select s.tier, s.expires_at, s.id
  from public.subscriptions s
  where s.user_id = v_user_id and s.status = 'active' and s.expires_at > now()
  order by case s.tier when 'vvip' then 2 else 1 end desc
  limit 1;
end;
$$;

grant execute on function public.get_my_vip_status() to authenticated;

-- The caller's own purchase history (all statuses) — for a "my subscription"
-- screen. Ownership is enforced inside the function, not by an RLS policy.
create or replace function public.get_my_subscriptions(p_limit int default 20)
returns table (
  id uuid, tier text, duration_days int, price_tjs numeric, currency text,
  status text, starts_at timestamptz, expires_at timestamptz, created_at timestamptz,
  cancelled_at timestamptz, cancel_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
begin
  if v_user_id is null then
    return;
  end if;

  return query
  select s.id, s.tier, s.duration_days, s.price_tjs, s.currency, s.status,
         s.starts_at, s.expires_at, s.created_at, s.cancelled_at, s.cancel_reason
  from public.subscriptions s
  where s.user_id = v_user_id
  order by s.created_at desc
  limit p_limit;
end;
$$;

grant execute on function public.get_my_subscriptions(int) to authenticated;

-- ============================================================================
-- Feed integration — search_items gains a live-computed vip_tier output
-- column and a bounded freshness boost. RETURNS TABLE shape changes, so
-- (same precedent as 20260919000000_items_city.sql) this is a drop +
-- recreate, not an in-place alter.
--
-- Boost mechanic: an active subscriber's item sorts as if its created_at
-- were feed_boost_hours newer (VIP: 24h, VVIP: 72h, from
-- vip_tier_benefits — admin-editable without a redeploy). This is placed
-- as a TIE-BREAKER strictly after the existing `i.date desc` (the item's
-- real reported lost/found date) — a boosted week-old post never beats a
-- genuinely more relevant fresher post reported today; it only wins ties
-- among same-day posts, and even then only for as long as the boost
-- window lasts, so no single paid item can dominate indefinitely.
-- ============================================================================
drop function if exists public.search_items(text, text, text, text, integer, integer, date, date, text, text);

create or replace function public.search_items(
  p_search text default null,
  p_category text default null,
  p_type text default null,
  p_user_id text default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_date_from date default null,
  p_date_to date default null,
  p_location_type text default null,
  p_city text default null
)
returns table (
  id uuid, user_id text, title text, description text, category text, type item_type,
  date date, reward text, created_at timestamptz, is_resolved boolean,
  moderation_status moderation_status, images jsonb, vip_tier text
)
language sql
stable
set search_path = public
as $$
  select
    i.id, i.user_id, i.title, i.description, i.category, i.type, i.date,
    i.reward, i.created_at, i.is_resolved, i.moderation_status,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('image_url', img.image_url, 'thumbnail_url', img.thumbnail_url) order by img.created_at)
        from item_images img
        where img.item_id = i.id
      ),
      '[]'::jsonb
    ) as images,
    coalesce(vip.tier, 'none') as vip_tier
  from items i
  left join lateral (
    select s.tier, b.feed_boost_hours
    from public.subscriptions s
    join public.vip_tier_benefits b on b.tier = s.tier
    where s.user_id = i.user_id and s.status = 'active' and s.expires_at > now()
    order by case s.tier when 'vvip' then 2 else 1 end desc
    limit 1
  ) vip on true
  where
    (i.status is null or i.status <> 'deleted')
    and (
      (p_user_id is not null and i.user_id = p_user_id)
      or (
        p_user_id is null
        and i.moderation_status = 'approved'
        and (i.is_resolved = false or i.is_resolved is null)
      )
    )
    and (p_category is null or p_category = 'All' or i.category = p_category)
    and (p_type is null or i.type::text = p_type)
    and (
      p_search is null or p_search = ''
      or i.title ilike '%' || p_search || '%'
      or i.description ilike '%' || p_search || '%'
    )
    and (p_date_from is null or i.created_at >= p_date_from::timestamptz)
    and (p_date_to is null or i.created_at < (p_date_to + 1)::timestamptz)
    and (
      p_location_type is null
      or (p_location_type = 'none' and i.location_type is null)
      or i.location_type = p_location_type
    )
    and (p_city is null or i.city = p_city)
  order by
    case when p_search is not null and p_search <> '' then
      case
        when i.title ilike p_search then 0
        when i.title ilike p_search || '%' then 1
        when i.title ilike '%' || p_search || '%' then 2
        else 3
      end
    else 0
    end asc,
    i.date desc,
    (i.created_at + make_interval(hours => coalesce(vip.feed_boost_hours, 0))) desc,
    i.created_at desc,
    i.id
  limit p_limit
  offset p_offset;
$$;

grant execute on function public.search_items(text, text, text, text, integer, integer, date, date, text, text) to anon, authenticated;

-- ============================================================================
-- Widen the Phase 4 notification-kind checks for subscription lifecycle
-- notices, reusing the existing architecture exactly as instructed.
-- ============================================================================
alter table public.dismissed_notifications drop constraint dismissed_notifications_kind_check;
alter table public.dismissed_notifications add constraint dismissed_notifications_kind_check
  check (kind in ('verification', 'category_post', 'ai_match', 'vip_status'));

alter table public.notification_reads drop constraint notification_reads_kind_check;
alter table public.notification_reads add constraint notification_reads_kind_check
  check (kind in ('category_post', 'expiry_confirm', 'ai_match', 'vip_status'));

create or replace function public.dismiss_notification(
  p_kind text,
  p_ref_id uuid,
  p_item_id uuid,
  p_item_title text,
  p_related_name text,
  p_related_avatar text,
  p_status text default null
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
set search_path = public
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
  if exists (select 1 from unnest(p_kinds) k where k not in ('category_post', 'expiry_confirm', 'ai_match', 'vip_status')) then
    raise exception 'Invalid kind';
  end if;

  insert into notification_reads (user_id, kind, ref_id)
  select v_user_id, k, r
  from unnest(p_kinds, p_ref_ids) as t(k, r)
  on conflict (user_id, kind, ref_id) do nothing;
end;
$$;

-- get_my_vip_notifications — a computed feed over subscription_events,
-- exactly like get_my_ai_match_notifications (Phase 5): 'activated' and
-- 'expired' events for the caller's own subscriptions, not yet dismissed.
-- 'created'/'payment_confirmed'/'renewed'/'upgraded'/'cancelled'/'revoked'
-- are recorded for audit but deliberately not surfaced as push-worthy
-- notices this phase (activated/expired cover the two states a user
-- actually needs to know about without over-notifying).
create or replace function public.get_my_vip_notifications(p_limit int default 20)
returns table (
  event_id uuid,
  subscription_id uuid,
  event_type text,
  tier text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
begin
  if v_user_id is null then
    return;
  end if;

  return query
  select e.id, e.subscription_id, e.event_type, s.tier, s.expires_at, e.created_at
  from public.subscription_events e
  join public.subscriptions s on s.id = e.subscription_id
  where e.user_id = v_user_id
    and e.event_type in ('activated', 'expired')
    and not exists (
      select 1 from public.dismissed_notifications d
      where d.user_id = v_user_id and d.kind = 'vip_status' and d.ref_id = e.id
    )
  order by e.created_at desc
  limit p_limit;
end;
$$;

grant execute on function public.get_my_vip_notifications(int) to authenticated;
