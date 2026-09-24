-- ============================================================================
-- Search v2 — typo-tolerant, token-aware, live-typing-friendly search_items.
--
-- NOTE: the search_items FUNCTION defined below is REPLACED by
-- 20260930000005_search_v2_tajik_fold.sql (different threshold 0.25, tiers,
-- plpgsql + EXECUTE). This file still owns the `search_tsv` column and its
-- GIN index, which the later function reads. Keep both files in order.
--
-- Before: plain `ilike '%q%'` on title/description. Zero tolerance for typos,
-- no per-word matching ("black wallet" would not find "wallet, black").
--
-- After, matching is layered into ranked tiers (lower = better; the tier is
-- the PRIMARY sort key, so a stronger kind of match always beats a weaker one):
--   0  title equals the query          (ilike, unchanged)
--   1  title starts with the query     (ilike, unchanged)
--   2  title contains the query        (ilike, unchanged)
--   3  description contains the query (ilike, unchanged) OR every typed word
--      is a PREFIX of some word in title/category/description (new FTS match
--      over the stored `search_tsv`)
--   4  title is trigram-similar to the query (new; typo tolerance)
-- Inside a tier: greatest(ts_rank, title similarity) desc, then the existing
-- `i.date desc` and VIP/VVIP boost tie-breaker, EXACTLY as in
-- 20260925000000_vip_vvip_subscriptions.sql (a boosted post still only wins
-- among same-relevance, same-day ties).
--
-- TAJIK CORRECTNESS RULE (non-negotiable): the tsvector uses the 'simple'
-- text-search config on purpose. 'simple' only lowercases and tokenizes; it
-- does NO stemming, stop-word removal or accent/letter folding. Tajik letters
-- ӣ қ ҳ ҷ ғ ӯ therefore stay distinct from their Russian look-alikes
-- (и к х ж г у) — қ != к, ҳ != х, ҷ != ж, ғ != г, ӯ != у, ӣ != и. Never switch
-- this to 'russian'/'english' (or wrap in unaccent) — it would silently make
-- unrelated Tajik words collide and mangle mixed EN/RU/TJ text. The trigram
-- tier is likewise byte-exact per character: a typo that swaps қ for к is
-- treated as an ordinary one-character typo, not as equality.
--
-- Query construction: hand-rolled prefix tsquery, NOT websearch_to_tsquery.
-- websearch_to_tsquery cannot express per-token prefix matching, so typing
-- "хуҷ" would not find "ҳуҷҷат" until the word was complete — the wrong
-- behaviour for as-you-type search. Instead the user text is tokenized by
-- to_tsvector('simple', ...) itself (which strips every tsquery operator
-- character — & | ! ( ) : ' " < > — so user input cannot inject query syntax
-- or raise a syntax error), and each resulting lexeme gets ':*' and is
-- AND-joined. null/blank/punctuation-only input yields a null tsquery and
-- the FTS tier is skipped (the previous early-exit behaviour is preserved).
--
-- Fuzzy threshold: similarity(title, q) > 0.15, applied via the index-backed
-- `%` operator with pg_trgm.similarity_threshold pinned to 0.15 on the
-- function (so the planner can use idx_items_title_trgm). 0.15 is the value
-- already proven on this dataset by 20260809010000_notifications_text_match_
-- title_only.sql: unrelated titles scored ~0.025, genuinely similar ones
-- ~0.478, so 0.15 sits far above the noise floor yet catches 1-2 character
-- typos on short words. Trigram matching is applied to TITLE only —
-- the same migration measured description-level similarity as too noisy
-- (0.1026 false positive) and deliberately excluded it.
--
-- Signature and return shape are UNCHANGED (10 args, 13 columns incl.
-- vip_tier) so no client (Web, app/, Edge Functions) needs a change; only
-- internal matching/ranking differs. Every non-search WHERE clause is
-- copied verbatim from 20260925000000.
--
-- Cost: items has ~111 rows; the generated stored column rewrite is trivial
-- and runs in one transaction.
--
-- Rollback (kept next to the change):
--   begin;
--   -- re-create search_items from 20260925000000_vip_vvip_subscriptions.sql
--   -- (same signature; `create or replace` is enough)
--   drop index if exists public.idx_items_search_tsv;
--   alter table public.items drop column if exists search_tsv;
--   commit;
-- ============================================================================
begin;

alter table public.items
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored;

create index if not exists idx_items_search_tsv
  on public.items using gin (search_tsv);

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
set pg_trgm.similarity_threshold = 0.15
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
  cross join lateral (
    select
      case
        when p_search is null or btrim(p_search) = '' then null::tsquery
        else (
          select nullif(
                   string_agg('''' || replace(replace(lexeme, '\', '\\'), '''', '''''') || ''':*', ' & ' order by lexeme),
                   ''
                 )::tsquery
          from unnest(tsvector_to_array(to_tsvector('simple', p_search))) as lexeme
        )
      end as q
  ) sq
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
      or (sq.q is not null and i.search_tsv @@ sq.q)
      or i.title % p_search
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
        when i.description ilike '%' || p_search || '%'
          or (sq.q is not null and i.search_tsv @@ sq.q) then 3
        else 4
      end
    else 0
    end asc,
    greatest(
      ts_rank(i.search_tsv, coalesce(sq.q, ''::tsquery)),
      similarity(i.title, coalesce(p_search, ''))
    ) desc,
    i.date desc,
    (i.created_at + make_interval(hours => coalesce(vip.feed_boost_hours, 0))) desc,
    i.created_at desc,
    i.id
  limit p_limit
  offset p_offset;
$$;

grant execute on function public.search_items(text, text, text, text, integer, integer, date, date, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
