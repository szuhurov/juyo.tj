-- ============================================================================
-- get_vip_items — the VIP/VVIP strip's data source.
--
-- The home "VIP" strip used to be derived from whatever feed page happened to
-- be loaded (first 20 rows), so an active VIP listing on a later page — or a
-- "found" one — never showed up. This returns ALL currently visible listings
-- of active VIP/VVIP subscribers (VVIP first, then newest), so both clients
-- can (a) render the strip from the server's truth and (b) drop exactly those
-- listings from the ordinary feed below it. When a subscription ends,
-- active_vip_tiers() stops returning that user, so the listings return to the
-- ordinary feed by themselves — nothing to clean up.
--
-- SECURITY INVOKER on purpose (same as search_items): the RLS of `items`
-- still decides what a caller may see (approved only for strangers). Only the
-- VIP set comes from the SECURITY DEFINER helper active_vip_tiers()
-- (20260930000006). Same 13-column shape as search_items, so the clients
-- reuse their Item type. Limit is capped at 50.
--
-- Rollback: drop function if exists public.get_vip_items(integer);
-- ============================================================================
begin;

create or replace function public.get_vip_items(p_limit integer default 20)
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
    coalesce((select jsonb_agg(jsonb_build_object('image_url', img.image_url, 'thumbnail_url', img.thumbnail_url) order by img.created_at)
              from item_images img where img.item_id = i.id), '[]'::jsonb) as images,
    v.tier as vip_tier
  from public.active_vip_tiers() v
  join public.items i on i.user_id = v.user_id
  where (i.status is null or i.status <> 'deleted')
    and i.moderation_status = 'approved'
    and (i.is_resolved = false or i.is_resolved is null)
  order by case v.tier when 'vvip' then 0 else 1 end, i.date desc, i.created_at desc, i.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.get_vip_items(integer) from public;
grant execute on function public.get_vip_items(integer) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
