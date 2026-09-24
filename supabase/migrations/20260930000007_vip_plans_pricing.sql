-- New VIP/VVIP price list:
--   VIP : 30 days = 60 TJS
--   VVIP: 15 days = 1000 TJS, 30 days = 1500 TJS
-- Old plans are deactivated (not deleted) because subscriptions.plan_id
-- references them; subscriptions snapshot price/duration, so history is intact.
-- Clients and create_subscription only read/accept is_active = true plans.
-- 15 days is new, so the duration CHECKs on vip_plans and subscriptions widen
-- from (5, 10, 30) to (5, 10, 15, 30).
--
-- Rollback:
--   update public.vip_plans set is_active = true where duration_days in (5, 10);
--   update public.vip_plans set is_active = false where tier = 'vvip' and duration_days = 15;
--   update public.vip_plans set price_tjs = 50   where tier = 'vip'  and duration_days = 30;
--   update public.vip_plans set price_tjs = 1000 where tier = 'vvip' and duration_days = 30;
--   (the widened CHECKs can stay; they only allow more values)

begin;

do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.vip_plans'::regclass, 'public.subscriptions'::regclass)
      and pg_get_constraintdef(c.oid) ilike '%duration_days%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.vip_plans
  add constraint vip_plans_duration_days_check check (duration_days in (5, 10, 15, 30));
alter table public.subscriptions
  add constraint subscriptions_duration_days_check check (duration_days in (5, 10, 15, 30));

update public.vip_plans set is_active = false;

insert into public.vip_plans (tier, duration_days, price_tjs, is_active) values
  ('vip',  30, 60.00,   true),
  ('vvip', 15, 1000.00, true),
  ('vvip', 30, 1500.00, true)
on conflict (tier, duration_days) do update
  set price_tjs = excluded.price_tjs, is_active = true;

commit;
