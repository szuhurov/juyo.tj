-- VIP goes back to three options (5 / 10 / 30 days); only VVIP is limited to two
-- (15 days = 1000, 30 days = 1500, see 20260930000007). VIP 30 days stays at 60 TJS.
--
-- Rollback:
--   update public.vip_plans set is_active = false where tier = 'vip' and duration_days in (5, 10);

update public.vip_plans set is_active = true, price_tjs = 25.00 where tier = 'vip' and duration_days = 5;
update public.vip_plans set is_active = true, price_tjs = 40.00 where tier = 'vip' and duration_days = 10;
update public.vip_plans set is_active = true, price_tjs = 60.00 where tier = 'vip' and duration_days = 30;
