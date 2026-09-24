-- ============================================================================
-- "New listing in your category" notifications v2 — one rule for both the
-- in-app list and the push, and only posts that could plausibly be yours.
--
-- Before:
--   * get_my_category_notifications (in-app list): opposite type + same
--     category; broad categories also needed title similarity > 0.15. It
--     ignored resolved listings on BOTH sides (a user whose wallet was
--     already returned kept getting "new wallet" notices), had no time
--     window, no city check, and could show the same pair a second time as
--     an AI match.
--   * notify-category-post (push) was looser still: every owner of an
--     opposite-type listing in the category, resolved or not, no similarity
--     at all — e.g. every found wallet in the country pushed every loser.
--
-- Now public.category_post_relevant(new, mine) is the single rule:
--   both listings live (approved, not resolved, not deleted), same category,
--   opposite type, different owners; the found one not dated more than
--   3 days before the lost one; if both cities are known they must match;
--   broad categories (Electronics, Clothing, Other) also need a similar or
--   synonymous title (Search v2 folding + match_titles_synonymous from
--   20260930000012); and pairs already surfaced as an AI match (>= 65) are
--   left to the AI-match notice so nothing shows twice.
-- The in-app list keeps a 30-day window. The push asks
-- get_category_post_recipients(item) — same rule — instead of its own query
-- (notify-category-post must be redeployed with the matching change).
--
-- Depends on 20260930000012_ai_matching_v2.sql (match_titles_synonymous).
-- Signature of get_my_category_notifications is unchanged (both clients).
--
-- Rollback:
--   re-create get_my_category_notifications from its previous migration
--   (live definition before this file), redeploy the previous
--   notify-category-post, then
--   drop function if exists public.get_category_post_recipients(uuid);
--   drop function if exists public.category_post_relevant(uuid, uuid);
-- ============================================================================

create or replace function public.category_post_relevant(p_new uuid, p_mine uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.items n
    join public.items m on m.id = p_mine
    where n.id = p_new
      and n.moderation_status = 'approved' and n.is_resolved is not true and (n.status is null or n.status <> 'deleted')
      and m.moderation_status = 'approved' and m.is_resolved is not true and (m.status is null or m.status <> 'deleted')
      and n.category = m.category
      and n.type <> m.type
      and n.user_id is distinct from m.user_id
      -- found more than 3 days before it was lost cannot be the same thing
      and (
        n.date is null or m.date is null
        or (case when n.type = 'found' then n.date - m.date else m.date - n.date end) >= -3
      )
      and (n.city is null or m.city is null or n.city = m.city)
      and (
        n.category not in ('Electronics', 'Clothing', 'Other')
        or similarity(coalesce(n.title_fold, ''), coalesce(m.title_fold, '')) > 0.15
        or public.match_titles_synonymous(n.title_fold, m.title_fold)
        or public.match_titles_synonymous(m.title_fold, n.title_fold)
      )
      and not exists (
        select 1 from public.item_matches im
        where im.score >= 65
          and ((im.lost_item_id = n.id and im.found_item_id = m.id)
            or (im.lost_item_id = m.id and im.found_item_id = n.id))
      )
  );
$$;

revoke all on function public.category_post_relevant(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_my_category_notifications(p_limit integer default 20)
returns table (
  item_id uuid, item_title text, category text, created_at timestamptz,
  poster_id text, poster_first_name text, poster_last_name text, poster_avatar_url text,
  item_image_url text, item_type item_type
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id, i.title, i.category, i.created_at,
    p.id, p.first_name, p.last_name, p.avatar_url,
    img.image_url,
    i.type
  from public.items i
  join public.profiles p on p.id = i.user_id
  left join lateral (
    select ii.image_url from public.item_images ii where ii.item_id = i.id order by ii.created_at asc limit 1
  ) img on true
  where i.moderation_status = 'approved'
    and i.is_resolved is not true
    and (i.status is null or i.status <> 'deleted')
    and i.user_id <> get_auth_id()
    and i.created_at > now() - interval '30 days'
    and exists (
      select 1 from public.items mine
      where mine.user_id = get_auth_id()
        and mine.category = i.category
        and mine.type <> i.type
        and public.category_post_relevant(i.id, mine.id)
    )
    and not exists (
      select 1 from public.dismissed_notifications d
      where d.user_id = get_auth_id() and d.kind = 'category_post' and d.ref_id = i.id
    )
  order by i.created_at desc
  limit p_limit;
$$;

-- For notify-category-post (service role only): who should get the push for
-- this new listing — exactly the users whose in-app list would show it.
create or replace function public.get_category_post_recipients(p_item_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct mine.user_id
  from public.items n
  join public.items mine on mine.category = n.category and mine.type <> n.type
  where n.id = p_item_id
    and mine.user_id is not null
    and public.category_post_relevant(n.id, mine.id);
$$;

revoke all on function public.get_category_post_recipients(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
