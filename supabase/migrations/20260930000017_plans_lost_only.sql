-- TOP/VIP is for LOST listings only — a finder has nothing to promote.
--
-- Before this, an account-level plan (subscriptions.item_id is null, bought
-- from the standalone /vip screen) boosted EVERY listing of that user,
-- found ones included, and create_subscription accepted a found listing.
--
--   * active_item_tiers(): only joins lost listings, so a found listing never
--     shows as TOP/VIP in the feed/carousel whatever subscription exists.
--   * create_subscription(): rejects a found listing.
--
-- Rollback: re-apply both functions from 20260930000015_plans_per_listing.sql.

create or replace function public.active_item_tiers()
returns table (item_id uuid, tier text, feed_boost_hours integer, starts_at timestamptz, price_tjs numeric)
language sql
stable security definer
set search_path to 'public'
as $$
  select distinct on (i.id) i.id, s.tier, b.feed_boost_hours, s.starts_at, s.price_tjs::numeric
  from public.subscriptions s
  join public.vip_tier_benefits b on b.tier = s.tier
  join public.items i on (s.item_id = i.id) or (s.item_id is null and i.user_id = s.user_id)
  where s.status = 'active' and s.expires_at > now()
    and i.type = 'lost'
  order by i.id, case s.tier when 'vvip' then 2 else 1 end desc, s.price_tjs desc, s.starts_at desc;
$$;

create or replace function public.create_subscription(p_plan_id uuid, p_item_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id text := get_auth_id();
  v_plan public.vip_plans%rowtype;
  v_sub_id uuid;
  v_old record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_plan from public.vip_plans where id = p_plan_id and is_active = true;
  if not found then
    raise exception 'Unknown or inactive plan';
  end if;

  if p_item_id is not null and not exists (
    select 1 from public.items where id = p_item_id and user_id = v_user_id
  ) then
    raise exception 'Listing not found';
  end if;

  if p_item_id is not null and exists (
    select 1 from public.items where id = p_item_id and type <> 'lost'
  ) then
    raise exception 'TOP/VIP is only for lost listings';
  end if;

  if v_plan.tier = 'vvip' and exists (
    select 1 from public.subscriptions
    where tier = 'vvip' and status = 'active' and expires_at > now()
      and not (user_id = v_user_id and item_id is not distinct from p_item_id)
  ) then
    raise exception 'VIP is currently taken';
  end if;

  for v_old in
    select id from public.subscriptions
    where user_id = v_user_id and status = 'pending' and item_id is not distinct from p_item_id
  loop
    update public.subscriptions
    set status = 'cancelled', cancelled_at = now(), cancelled_by = v_user_id,
        cancel_reason = 'replaced', updated_at = now()
    where id = v_old.id;
    insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id)
    values (v_old.id, v_user_id, 'cancelled', 'user', v_user_id);
  end loop;

  insert into public.subscriptions (user_id, plan_id, tier, duration_days, price_tjs, currency, item_id)
  values (v_user_id, v_plan.id, v_plan.tier, v_plan.duration_days, v_plan.price_tjs, v_plan.currency, p_item_id)
  returning id into v_sub_id;

  insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id)
  values (v_sub_id, v_user_id, 'created', 'user', v_user_id);

  return v_sub_id;
end;
$$;
