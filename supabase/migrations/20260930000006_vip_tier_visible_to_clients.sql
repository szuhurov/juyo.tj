-- ============================================================================
-- Fix: VIP/VVIP was invisible to every real client.
--
-- Since 20260925000000_vip_vvip_subscriptions.sql, search_items computed
-- `vip_tier` and the feed boost by joining `public.subscriptions` directly.
-- `subscriptions` has RLS enabled with NO policies (client-invisible on
-- purpose — a user must never read/alter anyone's subscription rows), and
-- search_items is SECURITY INVOKER (it must stay that way: it relies on the
-- RLS of `items` to hide pending/rejected listings). Result: for `anon` and
-- `authenticated` the join always saw ZERO rows, so vip_tier was always
-- 'none' — no VIP badge, no VIP carousel, no boost — while every test that
-- ran as the table owner (which bypasses RLS) passed. Found when an active
-- VIP subscription still showed as 'none' through the public REST API.
--
-- Fix: a tiny SECURITY DEFINER helper that returns ONLY
-- (user_id, tier, feed_boost_hours) of currently-active subscribers — exactly
-- what the public VIP badge already shows on every listing — and
-- search_items reads that instead of the table. `subscriptions` itself stays
-- closed (verified: anon/authenticated still read 0 rows from it).
-- The active set is tiny, and it is joined once (not per row).
--
-- search_items is otherwise identical to 20260930000005 (same signature,
-- tiers, owner rule, caps); only the VIP join changed.
--
-- Rollback:
--   re-create search_items from 20260930000005_search_v2_tajik_fold.sql, then
--   drop function if exists public.active_vip_tiers();
-- ============================================================================
select similarity('warmup', 'warmup');

begin;

create or replace function public.active_vip_tiers()
returns table (user_id text, tier text, feed_boost_hours integer)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (s.user_id) s.user_id, s.tier, b.feed_boost_hours
  from public.subscriptions s
  join public.vip_tier_benefits b on b.tier = s.tier
  where s.status = 'active' and s.expires_at > now()
  order by s.user_id, case s.tier when 'vvip' then 2 else 1 end desc;
$$;

revoke all on function public.active_vip_tiers() from public;
grant execute on function public.active_vip_tiers() to anon, authenticated;

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
    left join (select v.user_id, v.tier, v.feed_boost_hours from public.active_vip_tiers() v) vip
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

notify pgrst, 'reload schema';

commit;
