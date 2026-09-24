-- ============================================================================
-- Search v2, layer 2 — controlled Tajik/Russian/Latin normalization ("fold"),
-- cross-script matching, curated synonyms, multi-word relaxation, and a
-- rewrite of search_items for speed/predictability.
-- Builds on 20260930000004_search_v2_fts_trgm.sql (same search_items signature
-- and return shape; this migration REPLACES that function).
--
-- WHY A SECOND LAYER
-- Layer 1 (raw 'simple' FTS + trigram on the ORIGINAL letters) deliberately
-- treats Tajik letters as distinct from their Russian look-alikes
-- (қ != к, ҳ != х, ҷ != ж, ғ != г, ӯ != у, ӣ != и). That is correct for
-- precision, but real users type on Russian/Latin keyboards: "хуччат" for
-- "ҳуҷҷат", "hujjat"/"kalid"/"telefon" in Latin, "iphone" for "айфон".
-- Layer 2 handles that WITHOUT weakening layer 1:
--
--   * search_fold(text): a lossy, deterministic "skeleton" applied to BOTH the
--     stored text and the query. Tajik letters fold to their nearest Russian
--     letter (ҳ→х қ→к ғ→г ӯ→у ӣ→и ҷ→ч), ё→е, й→и, hard/soft signs and
--     apostrophes are dropped, Latin is transliterated to the same Cyrillic
--     skeleton (h→х j→ч sh→ш ch→ч kh→х ph→ф ...), repeated letters collapse
--     (чч→ч, лл→л).  hujjat = хуччат = Ҳуҷҷат = "хучат".
--   * The fold is only a FALLBACK: a match on the ORIGINAL letters (tiers 0-3)
--     always outranks a folded match (tier 4), which outranks a synonym match
--     (tiers 5-6). The fold never makes қ "equal" к in the primary tiers.
--   * search_synonyms: a small, curated, single-word synonym table
--     (iphone↔айфон, паспорт↔шиноснома↔passport, ключи↔калид↔key, ...).
--     Curated, not machine-translated: only unambiguous everyday
--     lost-and-found terms. Editable by service role without a deploy.
--     Tajik entries should be reviewed by a native speaker before extending.
--     A query word matches a synonym term by (1) same folded form or being a
--     PREFIX of the term (live typing: "iph" → iphone → айфон); only if that
--     finds nothing, (2) trigram similarity >= 0.25 (typo) or a letter
--     transposition (same first letter, same letters: "iphnoe", "lapotp").
--
-- TIERS (primary sort key, lower = better). Every tier is a cheap boolean
-- test, so ranking is predictable and fast; inside a tier the order is the
-- product's existing rule: i.date desc, then the unchanged VIP/VVIP boost
-- tie-breaker (EXACTLY as in 20260925000000_vip_vvip_subscriptions.sql — a
-- boosted post only wins among same-tier, same-day ties).
--   0 title equals query      1 title starts with query
--   2 title contains query (>= 3 chars)
--   3 the FOLDED title equals the folded query ("хуччат" == "ҳуҷҷат")
--   4 every query word is a word-prefix in the TITLE, original letters
--   5 ... in the TITLE, folded letters (cross-script / keyboard-layout typo)
--   6 ... in the TITLE via the squeezed variant ("i phone"/"i-phone" → iphone)
--   7 ... in the TITLE via a curated synonym
--   8 every word matches anywhere (title/category/description, any of the
--     modes above) or the description contains the query
--   9 relaxation: multi-word query where at least one significant (>= 4 char)
--     word (or its synonym) matches ("iphone 15" still shows iPhones when no
--     listing mentions 15). Ordered by ts_rank / trigram inside the tier.
--  10 fuzzy typo only: raw-title or folded-title trigram >= 0.25
--
-- p_user_id: narrows to one user's listings. Only that user themself (JWT id
-- = p_user_id) sees all of their own; RLS already hides pending/rejected from
-- everyone else, and this function additionally hides RESOLVED listings from
-- everyone but the owner (the feed hides them too). p_search is capped at 200
-- characters inside the function — an unbounded string would build a tsquery
-- word over Postgres' 2046-byte limit and raise an error (found by the test
-- suite in supabase/tests/database/search_v2.test.sql).
--
-- FUZZY THRESHOLD (measured on this dataset; supersedes the 0.15 of
-- 20260930000004): real typos ("телефонн", "айфн", "калит", "паспотр",
-- "samsnug", transposed "lapotp") score similarity >= 0.273; unrelated short
-- titles that merely share a leading trigram ("Novey" vs "ноутбук", "Форма"
-- vs "i phone", "Папка" vs "паспорт") score <= 0.182. 0.25 sits in that gap.
--
-- SHORT QUERIES: for 1-2 characters, substring/description/trigram matching
-- is disabled (it returned near-everything: "т" matched 68 of 111 items).
-- Only title-prefix and word-prefix matching apply. Whitespace-only input is
-- treated as no search (previously '   ' was an ilike '%   %' filter).
-- 1-character words next to other words ("i" in "i phone") are ignored;
-- hyphen / underscore / dot count as word separators ("i-phone" = "i phone").
--
-- WHY search_items IS NOW PLPGSQL + EXECUTE ... USING
-- A SQL-language function with a SET clause is never inlined and is planned
-- ONCE with unknown parameters (a generic plan). The planner then could not
-- use the GIN indexes for the parameter-derived patterns: on 30k synthetic
-- rows every search cost 1.0-1.9 s (the same query with constants: 8 ms).
-- EXECUTE ... USING plans each call with the real parameter values, so the
-- five GIN indexes are used; measured on 30k rows: 12-181 ms (rare word ~12 ms,
-- the most common word with ~4.5k exact-title hits ~160 ms).
-- p_limit is capped at 200 (the RPC is callable by anon).
--
-- Everything else (filters, visibility rules, VIP/VVIP tie-breaker) is copied
-- verbatim from 20260930000004 / 20260925000000. Signature and return shape
-- are unchanged, so no client (Web, app/, Edge Functions) needs a change.
-- Side effect worth knowing: the new stored columns (search_tsv, title_fold,
-- search_fold_tsv) are derived from title/category/description only — no new
-- personal data — but they do appear in `select *` snapshots of an items row
-- (e.g. deleted_items_archive.item_snapshot).
--
-- Rollback:
--   begin;
--   -- re-create search_items from 20260930000004_search_v2_fts_trgm.sql
--   drop function if exists public.search_build_queries(text);
--   drop function if exists public.search_synonym_terms(text);
--   drop function if exists public.search_tsq_quote(text);
--   drop index if exists public.idx_items_title_fold_trgm;
--   drop index if exists public.idx_items_search_fold_tsv;
--   alter table public.items drop column if exists search_fold_tsv;
--   alter table public.items drop column if exists title_fold;
--   drop table if exists public.search_synonyms;
--   drop function if exists public.search_fold(text);
--   commit;
--
-- NOTE: if search_fold() is ever changed, the stored generated columns above
-- do NOT recompute on `create or replace function` — drop and re-add them
-- (or rewrite every row) in the same migration.
-- NOTE: a function-level `SET pg_trgm.similarity_threshold` can only be
-- created in a session where the pg_trgm library is already loaded; the
-- `select similarity(...)` warm-up below does that.
-- ============================================================================
select similarity('warmup', 'warmup');

begin;

-- ----------------------------------------------------------------------------
-- 1) The fold function. IMMUTABLE (required for generated columns/indexes);
--    uses only pg_catalog built-ins, so search_path = '' is safe.
--    The to-string is shorter than the from-string on purpose: the trailing
--    from-chars (ъ ь and the apostrophes) have no counterpart and are DELETED.
-- ----------------------------------------------------------------------------
create or replace function public.search_fold(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $f$
  select regexp_replace(
    translate(
      replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
        lower(coalesce(t, '')),
        'shch', 'щ'), 'sh', 'ш'), 'ch', 'ч'), 'zh', 'ж'), 'kh', 'х'), 'gh', 'г'),
        'ph', 'ф'), 'ts', 'ц'), 'yo', 'е'), 'yu', 'ю'), 'ya', 'я'), 'ye', 'е'),
      'abcdefghijklmnopqrstuvwxyzҳқғӯӣҷёйъь''’ʼ',
      'абкдефгхичклмнопкрстуввхизхкгуичеи'
    ),
    '(.)\1+', '\1', 'g');
$f$;

-- ----------------------------------------------------------------------------
-- 2) Derived, always-in-sync columns + indexes. Same approach as search_tsv.
-- ----------------------------------------------------------------------------
alter table public.items
  add column if not exists title_fold text
    generated always as (public.search_fold(title)) stored,
  add column if not exists search_fold_tsv tsvector
    generated always as (
      setweight(to_tsvector('simple', public.search_fold(title)), 'A') ||
      setweight(to_tsvector('simple', public.search_fold(category)), 'B') ||
      setweight(to_tsvector('simple', public.search_fold(coalesce(description, ''))), 'C')
    ) stored;

create index if not exists idx_items_search_fold_tsv
  on public.items using gin (search_fold_tsv);

create index if not exists idx_items_title_fold_trgm
  on public.items using gin (title_fold gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 3) Curated synonyms. Public reference data (no personal data) — RLS on with
--    a read-only policy in this same migration; writes are service-role only.
--    Single words only (multi-word phrases are handled by the "squeezed"
--    query variant: "i phone"/"i-phone"/"power bank" → iphone/powerbank).
-- ----------------------------------------------------------------------------
create table if not exists public.search_synonyms (
  id         bigint generated always as identity primary key,
  group_key  text not null,
  term       text not null check (term = btrim(term) and term !~ '\s' and char_length(term) >= 2),
  term_fold  text generated always as (public.search_fold(term)) stored,
  unique (group_key, term_fold)
);

create index if not exists idx_search_synonyms_term_fold
  on public.search_synonyms (term_fold);

alter table public.search_synonyms enable row level security;
drop policy if exists search_synonyms_public_read on public.search_synonyms;
create policy search_synonyms_public_read on public.search_synonyms
  for select
  to anon, authenticated
  using (true);
revoke insert, update, delete, truncate on public.search_synonyms from anon, authenticated;

insert into public.search_synonyms (group_key, term) values
  ('phone', 'телефон'), ('phone', 'phone'), ('phone', 'telefon'), ('phone', 'смартфон'), ('phone', 'smartphone'),
  ('iphone', 'iphone'), ('iphone', 'айфон'),
  ('xiaomi', 'xiaomi'), ('xiaomi', 'сяоми'), ('xiaomi', 'ксиаоми'),
  ('huawei', 'huawei'), ('huawei', 'хуавей'),
  ('passport', 'паспорт'), ('passport', 'passport'), ('passport', 'шиноснома'), ('passport', 'загранпаспорт'),
  ('key', 'ключ'), ('key', 'ключи'), ('key', 'key'), ('key', 'keys'), ('key', 'калид'), ('key', 'калит'),
  ('wallet', 'кошелёк'), ('wallet', 'wallet'), ('wallet', 'ҳамён'), ('wallet', 'портмоне'), ('wallet', 'бумажник'),
  ('bag', 'сумка'), ('bag', 'сумочка'), ('bag', 'bag'), ('bag', 'handbag'), ('bag', 'ҷузвдон'),
  ('backpack', 'рюкзак'), ('backpack', 'backpack'),
  ('documents', 'документ'), ('documents', 'document'), ('documents', 'ҳуҷҷат'),
  ('laptop', 'ноутбук'), ('laptop', 'laptop'), ('laptop', 'notebook'), ('laptop', 'лаптоп'),
  ('tablet', 'планшет'), ('tablet', 'tablet'),
  ('headphones', 'наушники'), ('headphones', 'наушник'), ('headphones', 'headphones'), ('headphones', 'earphones'), ('headphones', 'airpods'),
  ('powerbank', 'повербанк'), ('powerbank', 'powerbank'), ('powerbank', 'павербанк'),
  ('charger', 'зарядка'), ('charger', 'зарядник'), ('charger', 'charger'),
  ('car', 'мошин'), ('car', 'машина'), ('car', 'автомобил'), ('car', 'авто'), ('car', 'car'),
  ('glasses', 'айнак'), ('glasses', 'очки'), ('glasses', 'glasses'), ('glasses', 'eyeglasses'),
  ('watch', 'соат'), ('watch', 'часы'), ('watch', 'watch'), ('watch', 'watches'),
  ('card', 'корт'), ('card', 'карта'), ('card', 'card'),
  ('umbrella', 'зонтик'), ('umbrella', 'зонт'), ('umbrella', 'umbrella'), ('umbrella', 'чатр'),
  ('hat', 'шапка'), ('hat', 'hat'), ('hat', 'cap'), ('hat', 'кулоҳ'),
  ('ring', 'ангуштарин'), ('ring', 'кольцо'), ('ring', 'ring')
on conflict (group_key, term_fold) do nothing;

-- ----------------------------------------------------------------------------
-- 4) Query builders. Kept in functions so the tsqueries are built ONCE per
--    search_items call (not once per items row).
-- ----------------------------------------------------------------------------

-- Quote one lexeme for tsquery text input: 'it''s' style, backslash-escaped.
-- Makes any token (URL, e-mail, apostrophe, colon) safe to cast to tsquery.
create or replace function public.search_tsq_quote(x text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select '''' || replace(replace(x, '\', '\\'), '''', '''''') || '''';
$$;

-- Folded terms of every synonym group that one query word belongs to.
-- Tight matches (same fold, or the word is a prefix of the term) win; loose
-- matches (typo similarity, letter transposition) are used only when there is
-- no tight match, so "iphone" never drifts into the "phone" group.
create or replace function public.search_synonym_terms(p_tok text)
returns table (term_fold text)
language sql
stable
set search_path = public
as $$
  with k as (select public.search_fold(p_tok) as f, lower(p_tok) as r),
  tight as (
    select s1.group_key
      from k
      join public.search_synonyms s1 on (
           s1.term_fold = k.f
        or (char_length(k.r) >= 3
            and lower(s1.term) like replace(replace(replace(k.r, '\', '\\'), '%', '\%'), '_', '\_') || '%')
      )
  ),
  loose as (
    select s1.group_key
      from k
      join public.search_synonyms s1 on (
           (char_length(k.f) >= 4 and similarity(s1.term_fold, k.f) >= 0.25)
        or (char_length(k.f) >= 4
            and left(s1.term_fold, 1) = left(k.f, 1)
            and char_length(s1.term_fold) = char_length(k.f)
            and (select string_agg(c, '' order by c) from regexp_split_to_table(s1.term_fold, '') c)
              = (select string_agg(c, '' order by c) from regexp_split_to_table(k.f, '') c))
      )
     where not exists (select 1 from tight)
  )
  select distinct s2.term_fold
    from public.search_synonyms s2
   where s2.group_key in (select group_key from tight union select group_key from loose);
$$;

-- All tsqueries for one search string (one row). NULL columns mean "that
-- matching mode does not apply to this query".
--   q_raw_tsq  original letters, every word a prefix, AND (any weight)
--   q_fold_tsq folded letters, every word a prefix, AND
--   q_syn_tsq  folded, per word (word:* | synonym:* | ...), AND — only when
--              at least one word actually has synonyms
--   q_sq_tsq   separators squeezed out ("i phone" → iphone) + its exact synonyms
--   q_any_tsq  multi-word relaxation: OR over significant (>= 4 char) words
--              and their synonyms; only for queries with >= 2 words
--   qa_*       the same four, restricted to TITLE text (':*A' = weight A)
create or replace function public.search_build_queries(p_q text)
returns table (
  q_raw_tsq tsquery, q_fold_tsq tsquery, q_syn_tsq tsquery, q_sq_tsq tsquery, q_any_tsq tsquery,
  qa_raw tsquery, qa_fold tsquery, qa_syn tsquery, qa_sq tsquery
)
language sql
stable
set search_path = public
as $$
  with
  -- hyphen / underscore / dot are word separators for tokenizing ("i-phone" ==
  -- "i phone"); the squeezed variant below still sees the ORIGINAL string.
  toks_all as (
    select lex as tok, public.search_fold(lex) as fold_tok
      from unnest(tsvector_to_array(to_tsvector('simple', regexp_replace(p_q, '[-_.]+', ' ', 'g')))) as lex
  ),
  -- 1-character words ("i", "и", "a") are noise next to other words; a lone
  -- 1-char query is still searched as-is.
  toks as (
    select * from toks_all where char_length(tok) >= 2 or (select count(*) from toks_all) = 1
  ),
  alts as (
    select t.tok, t.fold_tok as x, false as is_syn from toks t
    union
    select t.tok, s.term_fold, true
      from toks t
      cross join lateral public.search_synonym_terms(t.tok) s
  ),
  -- squeezed variant: EXACT synonym match only, so it stays a strong signal
  -- instead of a loose expansion.
  squeezed as (
    select public.search_fold(regexp_replace(p_q, '[\s\-_.]+', '', 'g')) as x
     where p_q ~ '[\s\-_.]'
    union
    select s2.term_fold
      from public.search_synonyms s1
      join public.search_synonyms s2 on s2.group_key = s1.group_key
     where p_q ~ '[\s\-_.]'
       and s1.term_fold = public.search_fold(regexp_replace(p_q, '[\s\-_.]+', '', 'g'))
  ),
  txt as (
    select
      (select string_agg(public.search_tsq_quote(tok) || ':*', ' & ' order by tok) from toks) as raw_t,
      (select string_agg(public.search_tsq_quote(fold_tok) || ':*', ' & ' order by fold_tok) from toks) as fold_t,
      (select string_agg('(' || a.alt || ')', ' & ' order by a.tok)
         from (
           select tok, string_agg(public.search_tsq_quote(x) || ':*', ' | ' order by x) as alt
             from alts
            group by tok
         ) a
        where exists (select 1 from alts where is_syn)) as syn_t,
      (select string_agg(public.search_tsq_quote(x) || ':*', ' | ' order by x) from squeezed) as sq_t,
      (select string_agg(public.search_tsq_quote(z.x) || ':*', ' | ' order by z.x)
         from (
           select distinct a.x
             from alts a
             join toks t on t.tok = a.tok
            where char_length(t.tok) >= 4
         ) z
        where (select count(*) from toks) >= 2) as any_t
  )
  select
    nullif(raw_t, '')::tsquery,
    nullif(fold_t, '')::tsquery,
    nullif(syn_t, '')::tsquery,
    nullif(sq_t, '')::tsquery,
    nullif(any_t, '')::tsquery,
    -- ':*A' = the word may only match TITLE text (weight A)
    nullif(replace(raw_t,  ''':*', ''':*A'), '')::tsquery,
    nullif(replace(fold_t, ''':*', ''':*A'), '')::tsquery,
    nullif(replace(syn_t,  ''':*', ''':*A'), '')::tsquery,
    nullif(replace(sq_t,   ''':*', ''':*A'), '')::tsquery
  from txt;
$$;

grant execute on function public.search_tsq_quote(text) to anon, authenticated;
grant execute on function public.search_synonym_terms(text) to anon, authenticated;
grant execute on function public.search_build_queries(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5) search_items — same signature/return shape; matching + ranking extended.
--    plpgsql + EXECUTE ... USING on purpose (see header): the query is planned
--    with the real parameter values on every call.
-- ----------------------------------------------------------------------------
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
    left join lateral (
      select s.tier, b.feed_boost_hours
      from public.subscriptions s join public.vip_tier_benefits b on b.tier = s.tier
      where s.user_id = i.user_id and s.status = 'active' and s.expires_at > now()
      order by case s.tier when 'vvip' then 2 else 1 end desc
      limit 1
    ) vip on true
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

grant execute on function public.search_items(text, text, text, text, integer, integer, date, date, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
