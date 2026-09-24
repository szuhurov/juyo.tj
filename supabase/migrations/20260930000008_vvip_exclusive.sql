-- VVIP is exclusive: at most ONE active VVIP subscription in the whole app.
-- "Active" is the same live check used everywhere else:
--   status = 'active' and expires_at > now()
--
--   * create_subscription: refuses a VVIP purchase while ANOTHER user holds an
--     active VVIP. The holder may renew (their own row does not block them).
--   * admin_activate_subscription: re-checks at activation time, so two pending
--     VVIP requests can't both become active (the second activation fails).
--   * get_vvip_availability(): public, PII-free — tells the client whether the
--     VVIP slot is free and, if not, when it frees up.
--
-- Pending requests deliberately do NOT block others: payment is confirmed
-- manually by an admin, and a pending row costs the requester nothing, so
-- letting it block the slot would let anyone lock VVIP without paying.
--
-- Rollback: re-run the two function bodies from
-- 20260925000000_vip_vvip_subscriptions.sql and
--   drop function if exists public.get_vvip_availability();

begin;

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

  if v_plan.tier = 'vvip' and exists (
    select 1 from public.subscriptions
    where tier = 'vvip' and status = 'active' and expires_at > now() and user_id <> v_user_id
  ) then
    raise exception 'VVIP is currently taken';
  end if;

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

  if v_sub.tier = 'vvip' and exists (
    select 1 from public.subscriptions
    where tier = 'vvip' and status = 'active' and expires_at > now() and user_id <> v_sub.user_id
  ) then
    raise exception 'VVIP is currently taken';
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

create or replace function public.get_vvip_availability()
returns table (is_available boolean, available_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    not exists (select 1 from public.subscriptions where tier = 'vvip' and status = 'active' and expires_at > now()),
    (select max(expires_at) from public.subscriptions where tier = 'vvip' and status = 'active' and expires_at > now());
$$;

grant execute on function public.get_vvip_availability() to anon, authenticated;

commit;
