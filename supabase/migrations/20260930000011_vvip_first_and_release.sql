-- ============================================================================
-- VIP/VVIP behave exactly as the plan text promises.
--
-- 1. VVIP is always first; VIPs follow, ranked by the amount PAID (a
--    30-day VIP for 60 TJS must not sink under ten 25 TJS buyers who came
--    later), then by newest purchase (activation) when the amount is equal.
--    - get_vip_items (the "important listings" strip): was VVIP first, then
--      by the listing's own date. Now VVIP, then VIP by price paid desc,
--      then subscription starts_at desc, then listing date.
--    - search_items (the feed): when browsing (no search text), VVIP is on
--      top, then VIPs by price paid, then purchase date, then the regular order. On the
--      default feed the clients already move paid listings into the strip;
--      this makes the filtered feed (category/type/date/city) agree. With
--      search text the order stays relevance-first (unchanged).
--    active_vip_tiers() gains starts_at and price_tjs for that (return type change ->
--    drop + create; search_items/get_vip_items reference it only inside
--    their bodies, so nothing depends on it at the catalog level).
--
-- 2. The single VVIP slot frees up as soon as its holder has no live
--    listing left (all deleted / resolved / rejected), not only at expiry:
--    trigger on items marks the holder's active VVIP subscription
--    "expired" (+ subscription_events row, reason no_live_items).
--    "Live" = not deleted, not resolved, not rejected (pending counts as
--    live, so a fresh listing awaiting moderation keeps the slot).
--    subscription_events has no FK to profiles, so account deletion
--    (which deletes items) is unaffected.
--
-- Clients: no change needed — both app/ and Web/ read vip_tier and the
-- row order from these RPCs; the VVIP availability check
-- (get_vvip_availability / create_subscription) already reads
-- subscriptions.status, which the trigger updates.
--
-- Rollback:
--   drop trigger if exists trg_release_vvip_on_item_update on public.items;
--   drop trigger if exists trg_release_vvip_on_item_delete on public.items;
--   drop function if exists public.release_vvip_when_no_live_items();
--   re-run 20260930000006 (active_vip_tiers + search_items; drop
--   active_vip_tiers first, its return type differs) and
--   20260930000007_get_vip_items.sql.
--   Subscriptions already expired by the trigger must be restored by hand
--   (subscription_events reason = no_live_items lists them).
-- ============================================================================
select similarity('warmup', 'warmup');

begin;

drop function if exists public.active_vip_tiers();

create function public.active_vip_tiers()
returns table (user_id text, tier text, feed_boost_hours integer, starts_at timestamptz, price_tjs numeric)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (s.user_id) s.user_id, s.tier, b.feed_boost_hours, s.starts_at, s.price_tjs::numeric
  from public.subscriptions s
  join public.vip_tier_benefits b on b.tier = s.tier
  where s.status = 'active' and s.expires_at > now()
  order by s.user_id, case s.tier when 'vvip' then 2 else 1 end desc;
$$;

revoke all on function public.active_vip_tiers() from public;
grant execute on function public.active_vip_tiers() to anon, authenticated;

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
  order by case v.tier when 'vvip' then 0 else 1 end,
           v.price_tjs desc nulls last,
           v.starts_at desc nulls last,
           i.date desc, i.created_at desc, i.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

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
language plpgsql
stable
set search_path = public
set pg_trgm.similarity_threshold = 0.25
as $fn$
begin
  return query execute $q$
    select
      i.id, i.user_id, i.title, i.description, i.category, i.type, i.date,
      i.reward, i.created_at, i.is_resolved, i.moderation_status,
      coalesce((select jsonb_agg(jsonb_build_object('image_url', img.image_url, 'thumbnail_url', img.thumbnail_url) order by img.created_at)
                from item_images img where img.item_id = i.id), '[]'::jsonb) as images,
      coalesce(vip.tier, 'none') as vip_tier
    from (
      -- The query is capped at 200 characters HERE (the RPC is public): an
      -- unbounded string would build a tsquery word over Postgres' 2046-byte
      -- limit and raise an error.
      -- q_raw keeps the client's backslash escapes (\% \_ \\) and is used ONLY
      -- by ilike, where backslash is the escape character. q_plain strips them
      -- and feeds everything else (folding, FTS, trigram, length checks).
      select nullif(btrim(left($1, 200)), '') as q_raw,
             nullif(btrim(replace(left($1, 200), '\', '')), '') as q_plain,
             public.get_auth_id() as me
    ) s0
    cross join lateral (
      select s0.q_raw, s0.q_plain, s0.me,
             case when s0.q_plain is null then null else public.search_fold(s0.q_plain) end as q_fold
    ) sa
    cross join lateral public.search_build_queries(sa.q_plain) sq
    cross join items i
    cross join lateral (
      select case when sa.q_raw is null then 0 else
        case
          when i.title ilike sa.q_raw then 0
          when i.title ilike sa.q_raw || '%' then 1
          when char_length(sa.q_plain) >= 3 and i.title ilike '%' || sa.q_raw || '%' then 2
          when sa.q_fold is not null and i.title_fold = sa.q_fold then 3
          when sq.qa_raw  is not null and i.search_tsv      @@ sq.qa_raw  then 4
          when sq.qa_fold is not null and i.search_fold_tsv @@ sq.qa_fold then 5
          when sq.qa_sq   is not null and i.search_fold_tsv @@ sq.qa_sq   then 6
          when sq.qa_syn  is not null and i.search_fold_tsv @@ sq.qa_syn  then 7
          when (char_length(sa.q_plain) >= 3 and i.description ilike '%' || sa.q_raw || '%')
            or (sq.q_raw_tsq  is not null and i.search_tsv      @@ sq.q_raw_tsq)
            or (sq.q_fold_tsq is not null and i.search_fold_tsv @@ sq.q_fold_tsq)
            or (sq.q_syn_tsq  is not null and i.search_fold_tsv @@ sq.q_syn_tsq)
            or (sq.q_sq_tsq   is not null and i.search_fold_tsv @@ sq.q_sq_tsq) then 8
          when sq.q_any_tsq is not null and i.search_fold_tsv @@ sq.q_any_tsq then 9
          else 10
        end
      end as tier
    ) t
    -- joined ONCE (a function scan of the tiny active-VIP set), not per row
    left join (select v.user_id, v.tier, v.feed_boost_hours, v.starts_at, v.price_tjs from public.active_vip_tiers() v) vip
      on vip.user_id = i.user_id
    where
      (i.status is null or i.status <> 'deleted')
      -- p_user_id narrows to one user's listings. Only that user themself sees
      -- all of their own (RLS additionally hides pending/rejected from anyone
      -- else); everyone else gets the public rule: approved and unresolved.
      and ($4 is null or i.user_id = $4)
      and (
        ($4 is not null and $4 = sa.me)
        or (i.moderation_status = 'approved' and (i.is_resolved = false or i.is_resolved is null))
      )
      and ($2 is null or $2 = 'All' or i.category = $2)
      and ($3 is null or i.type::text = $3)
      and (
        sa.q_raw is null
        or i.title ilike sa.q_raw || '%'
        or (sq.q_raw_tsq  is not null and i.search_tsv      @@ sq.q_raw_tsq)
        or (sq.q_fold_tsq is not null and i.search_fold_tsv @@ sq.q_fold_tsq)
        or (sq.q_syn_tsq  is not null and i.search_fold_tsv @@ sq.q_syn_tsq)
        or (sq.q_sq_tsq   is not null and i.search_fold_tsv @@ sq.q_sq_tsq)
        or (sq.q_any_tsq  is not null and i.search_fold_tsv @@ sq.q_any_tsq)
        or (char_length(sa.q_plain) >= 3 and (
              i.title ilike '%' || sa.q_raw || '%'
              or i.description ilike '%' || sa.q_raw || '%'
              or (char_length(sa.q_plain) <= 40 and (i.title % sa.q_plain or i.title_fold % sa.q_fold))))
      )
      and ($7 is null or i.created_at >= $7::date::timestamptz)
      and ($8 is null or i.created_at < ($8::date + 1)::timestamptz)
      and ($9 is null or ($9 = 'none' and i.location_type is null) or i.location_type = $9)
      and ($10 is null or i.city = $10)
    order by
      -- Browsing (no search text, not one user's own list): VVIP first,
      -- then VIPs by amount paid (more first), then newest purchase, then everyone else.
      -- With search text, relevance decides — a paid listing that does
      -- not match the query well must not jump over one that does.
      case when sa.q_raw is null and $4 is null then
        case vip.tier when 'vvip' then 0 when 'vip' then 1 else 2 end
      else 0 end asc,
      case when sa.q_raw is null and $4 is null then vip.price_tjs end desc nulls last,
      case when sa.q_raw is null and $4 is null then vip.starts_at end desc nulls last,
      t.tier asc,
      case when t.tier >= 9 then
        greatest(
          coalesce(ts_rank(i.search_fold_tsv, sq.q_any_tsq), 0),
          0.6 * coalesce(similarity(i.title, sa.q_plain), 0),
          0.6 * coalesce(similarity(i.title_fold, sa.q_fold), 0))
      else 0 end desc,
      i.date desc,
      (i.created_at + make_interval(hours => coalesce(vip.feed_boost_hours, 0))) desc,
      i.created_at desc,
      i.id
    limit least(greatest(coalesce($5, 20), 1), 200)
    offset greatest(coalesce($6, 0), 0)
  $q$ using p_search, p_category, p_type, p_user_id, p_limit, p_offset, p_date_from, p_date_to, p_location_type, p_city;
end;
$fn$;

create or replace function public.release_vvip_when_no_live_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  v_sub record;
begin
  if exists (
    select 1 from public.items i
    where i.user_id = v_user
      and (i.status is null or i.status <> 'deleted')
      and i.is_resolved is not true
      and i.moderation_status <> 'rejected'
  ) then
    return null;
  end if;

  for v_sub in
    select s.id from public.subscriptions s
    where s.user_id = v_user and s.tier = 'vvip' and s.status = 'active' and s.expires_at > now()
  loop
    update public.subscriptions set status = 'expired', updated_at = now() where id = v_sub.id;
    insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id, metadata)
    values (v_sub.id, v_user, 'expired', 'system', null, jsonb_build_object('reason', 'no_live_items'));
  end loop;
  return null;
end;
$$;

revoke all on function public.release_vvip_when_no_live_items() from public, anon, authenticated;

drop trigger if exists trg_release_vvip_on_item_update on public.items;
create trigger trg_release_vvip_on_item_update
  after update of status, is_resolved, moderation_status on public.items
  for each row
  when (old.status is distinct from new.status
        or old.is_resolved is distinct from new.is_resolved
        or old.moderation_status is distinct from new.moderation_status)
  execute function public.release_vvip_when_no_live_items();

drop trigger if exists trg_release_vvip_on_item_delete on public.items;
create trigger trg_release_vvip_on_item_delete
  after delete on public.items
  for each row
  execute function public.release_vvip_when_no_live_items();

notify pgrst, 'reload schema';

commit;
