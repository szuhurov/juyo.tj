-- A new VIP/VVIP request now REPLACES the user's own pending one instead of
-- failing with "You already have a pending subscription request". Without
-- this a single stale pending row (e.g. for a plan that no longer exists)
-- blocked every later purchase for that user.
--
-- Only the caller's own PENDING rows are cancelled (reason 'replaced'); an
-- ACTIVE subscription is untouched (renewal/upgrade is still handled at
-- activation). The VVIP exclusivity check from 20260930000008 is unchanged.
--
-- Rollback: re-run create_subscription from 20260930000008_vvip_exclusive.sql.

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
  v_old record;
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

  for v_old in
    select id from public.subscriptions where user_id = v_user_id and status = 'pending'
  loop
    update public.subscriptions
    set status = 'cancelled', cancelled_at = now(), cancelled_by = v_user_id,
        cancel_reason = 'replaced', updated_at = now()
    where id = v_old.id;
    insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id)
    values (v_old.id, v_user_id, 'cancelled', 'user', v_user_id);
  end loop;

  insert into public.subscriptions (user_id, plan_id, tier, duration_days, price_tjs, currency)
  values (v_user_id, v_plan.id, v_plan.tier, v_plan.duration_days, v_plan.price_tjs, v_plan.currency)
  returning id into v_sub_id;

  insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id)
  values (v_sub_id, v_user_id, 'created', 'user', v_user_id);

  return v_sub_id;
end;
$$;

grant execute on function public.create_subscription(uuid) to authenticated;
