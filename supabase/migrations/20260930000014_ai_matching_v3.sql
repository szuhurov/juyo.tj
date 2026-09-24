-- ============================================================================
-- AI matching v3 — smarter scoring on top of v2 (20260930000012).
--
-- What v2 still missed:
--   * Related categories never met: a lost "Phone" and a found phone filed
--     under "Electronics" (both exist in live data) could not match, same
--     for a wallet vs. the cards / documents that were in it.
--   * Every shared word counted the same: "phone" (in half the listings)
--     weighed as much as "iPhone 13" or a brand name.
--   * Colour was invisible: "black wallet" vs "red wallet" scored like a
--     perfect pair.
--
-- v3 score (0-100; thresholds unchanged: stored >= 40, "Matches" >= 50,
-- push >= 65):
--   image     35  graded over embedding cosine 0.55..0.80 (was 40)
--   words     20  distinctive shared words: IDF-weighted overlap of the
--                 folded title+description tokens (match_term_idf), so rare
--                 words (brands, models, numbers) dominate and common ones
--                 barely count (replaces the flat description trigram)
--   title     15  trigram on title_fold or a synonym hit (was 20)
--   colour   +8 / -12  shared colour word / both name colours, none shared
--   city      10  same city; -15 when both are known and differ
--   place      5  same location_type
--   date      15  found 0..30 days after lost; found > 3 days before lost is
--                 not a match
--   related category  Phone<->Electronics (no penalty: same thing),
--                     Wallet<->Cards<->Documents (-5: maybe inside it)
-- Reason codes stay within the set the shipped mobile app knows
-- (words/colour fold into similar_description).
--
-- Nightly job "rescore-ai-matches" (02:30 UTC) refreshes the word
-- statistics and re-scores every live listing, so date decay and new
-- listings' vocabulary are reflected. Pairs that newly reach 65 get their
-- one push (notified_at); already-notified pairs are never pushed again.
-- The backfill in this migration runs with pushes suppressed.
--
-- Nothing new is sent anywhere: all inputs are existing listing text and
-- existing embeddings.
--
-- Rollback:
--   select cron.unschedule('rescore-ai-matches');
--   re-run 20260930000012_ai_matching_v2.sql (run_ai_matching_for_item),
--   drop function if exists public.match_tokens(text);
--   drop function if exists public.match_categories_related(text, text);
--   drop function if exists public.refresh_match_term_idf();
--   drop table if exists public.match_term_idf, public.match_colors;
-- ============================================================================

-- Folded word tokens of a text: Search v2 folding, split on non-alphanumerics,
-- words of 3+ letters or anything containing a digit (model numbers), with the
-- Tajik izafa "-и" stripped from longer words ("телефони" -> "телефон").
create or replace function public.match_tokens(p text)
returns text[]
language sql
immutable
parallel safe
set search_path = public
as $$
  select coalesce(array_agg(distinct tok), '{}')
  from (
    select case when char_length(w) >= 5 and w like '%и' then left(w, -1) else w end as tok
    from regexp_split_to_table(public.search_fold(coalesce(p, '')), '[^[:alnum:]]+') w
    where char_length(w) >= 3 or (char_length(w) >= 2 and w ~ '[0-9]')
  ) t;
$$;

create or replace function public.match_categories_related(a text, b text)
returns boolean
language sql
immutable
parallel safe
as $$
  select a = b
      or (least(a, b), greatest(a, b)) in (
           ('Electronics', 'Phone'),
           ('Cards', 'Wallet'),
           ('Documents', 'Wallet'),
           ('Cards', 'Documents'));
$$;

-- Word statistics for IDF (service-role only: RLS on, no policies).
create table if not exists public.match_term_idf (
  term text primary key,
  idf  double precision not null
);
alter table public.match_term_idf enable row level security;

create or replace function public.refresh_match_term_idf()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n double precision;
begin
  select greatest(count(*), 1) into v_n from public.items where status is null or status <> 'deleted';

  delete from public.match_term_idf;
  insert into public.match_term_idf (term, idf)
  select t, ln((v_n + 1) / (count(*) + 0.5))
  from public.items i
  cross join lateral unnest(public.match_tokens(i.title || ' ' || coalesce(i.description, ''))) t
  where i.status is null or i.status <> 'deleted'
  group by t;
end;
$$;

revoke all on function public.refresh_match_term_idf() from public, anon, authenticated;

-- Colour words (tj / ru / en), stored folded. Service-role only.
create table if not exists public.match_colors (
  term_fold text primary key,
  group_key text not null
);
alter table public.match_colors enable row level security;

insert into public.match_colors (term_fold, group_key)
select distinct on (public.search_fold(term)) public.search_fold(term), group_key
from (values
  ('black',  'сиёҳ'), ('black', 'сиёҳранг'), ('black', 'черный'), ('black', 'черная'), ('black', 'черное'), ('black', 'черные'), ('black', 'черного'), ('black', 'black'),
  ('white',  'сафед'), ('white', 'белый'), ('white', 'белая'), ('white', 'белое'), ('white', 'белые'), ('white', 'белого'), ('white', 'white'),
  ('red',    'сурх'), ('red', 'красный'), ('red', 'красная'), ('red', 'красное'), ('red', 'красные'), ('red', 'red'),
  ('blue',   'кабуд'), ('blue', 'синий'), ('blue', 'синяя'), ('blue', 'синее'), ('blue', 'синие'), ('blue', 'голубой'), ('blue', 'голубая'), ('blue', 'blue'),
  ('green',  'сабз'), ('green', 'зеленый'), ('green', 'зеленая'), ('green', 'зеленое'), ('green', 'зеленые'), ('green', 'green'),
  ('yellow', 'зард'), ('yellow', 'желтый'), ('yellow', 'желтая'), ('yellow', 'желтое'), ('yellow', 'yellow'),
  ('gray',   'хокистарӣ'), ('gray', 'хокистари'), ('gray', 'серый'), ('gray', 'серая'), ('gray', 'серое'), ('gray', 'серые'), ('gray', 'gray'), ('gray', 'grey'),
  ('brown',  'қаҳвагӣ'), ('brown', 'коричневый'), ('brown', 'коричневая'), ('brown', 'коричневое'), ('brown', 'brown'),
  ('pink',   'гулобӣ'), ('pink', 'розовый'), ('pink', 'розовая'), ('pink', 'розовое'), ('pink', 'pink'),
  ('purple', 'бунафш'), ('purple', 'фиолетовый'), ('purple', 'фиолетовая'), ('purple', 'purple'),
  ('orange', 'норинҷӣ'), ('orange', 'оранжевый'), ('orange', 'оранжевая'), ('orange', 'orange'),
  ('gold',   'тиллоӣ'), ('gold', 'золотой'), ('gold', 'золотая'), ('gold', 'золотистый'), ('gold', 'gold'),
  ('silver', 'нуқрагӣ'), ('silver', 'серебряный'), ('silver', 'серебристый'), ('silver', 'silver'),
  ('beige',  'бежевый'), ('beige', 'бежевая'), ('beige', 'beige')
) v(group_key, term)
order by public.search_fold(term)
on conflict (term_fold) do nothing;

create or replace function public.run_ai_matching_for_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.items%rowtype;
  c record;
  v_score numeric;
  v_reasons text[];
  v_img double precision;
  v_title double precision;
  v_gap int;
  v_lost uuid;
  v_found uuid;
  v_keep uuid[] := '{}';
  v_max_idf double precision;
  v_toks text[];
  v_toks_w double precision;
  v_c_toks text[];
  v_c_w double precision;
  v_shared double precision;
  v_words double precision;
  v_colors text[];
  v_c_colors text[];
  v_desc_hit boolean;
begin
  select * into v_item from public.items where id = p_item_id;

  if not found
     or v_item.moderation_status <> 'approved'
     or v_item.is_resolved is true
     or v_item.status = 'deleted' then
    delete from public.item_matches where lost_item_id = p_item_id or found_item_id = p_item_id;
    return;
  end if;

  -- unseen words (no stats yet) count as the rarest ones
  select coalesce(max(idf), ln(2.0)) into v_max_idf from public.match_term_idf;

  v_toks := public.match_tokens(v_item.title || ' ' || coalesce(v_item.description, ''));
  select coalesce(sum(coalesce(m.idf, v_max_idf)), 0) into v_toks_w
  from unnest(v_toks) t left join public.match_term_idf m on m.term = t;
  select coalesce(array_agg(distinct mc.group_key), '{}') into v_colors
  from unnest(v_toks) t join public.match_colors mc on mc.term_fold = t;

  for c in
    select i.id, i.category, i.title, i.title_fold, i.description, i.city, i.location_type, i.date
    from public.items i
    where i.type <> v_item.type
      and public.match_categories_related(i.category, v_item.category)
      and i.id <> v_item.id
      and i.user_id is distinct from v_item.user_id
      and i.moderation_status = 'approved'
      and i.is_resolved is not true
      and (i.status is null or i.status <> 'deleted')
  loop
    if v_item.type = 'lost' then
      v_lost := v_item.id; v_found := c.id; v_gap := c.date - v_item.date;
    else
      v_lost := c.id; v_found := v_item.id; v_gap := v_item.date - c.date;
    end if;

    -- found more than 3 days before it was lost: cannot be the same thing
    continue when v_gap is not null and v_gap < -3;

    v_score := 0;
    v_reasons := array['same_category'];
    v_desc_hit := false;

    -- a phone filed under Electronics is the same thing; wallet / cards /
    -- documents are only "maybe inside it", so a small penalty
    if c.category <> v_item.category
       and not (least(c.category, v_item.category) = 'Electronics' and greatest(c.category, v_item.category) = 'Phone') then
      v_score := v_score - 5;
    end if;

    -- image (embedding of the photo's AI description)
    select max(1 - (a.embedding <=> b.embedding)) into v_img
    from public.item_images a
    join public.item_images b on true
    where a.item_id = v_item.id and b.item_id = c.id
      and a.embedding is not null and b.embedding is not null;
    if v_img is not null and v_img > 0.55 then
      v_score := v_score + 35 * least(1, (v_img - 0.55) / 0.25);
      if v_img >= 0.68 then
        v_reasons := array_append(v_reasons, 'similar_image');
      end if;
    end if;

    -- title: trigram or curated synonym
    v_title := similarity(coalesce(v_item.title_fold, ''), coalesce(c.title_fold, ''));
    if v_title < 0.6
       and (public.match_titles_synonymous(v_item.title_fold, c.title_fold)
            or public.match_titles_synonymous(c.title_fold, v_item.title_fold)) then
      v_title := 0.6;
    end if;
    if v_title > 0.2 then
      v_score := v_score + 15 * least(1, v_title / 0.6);
      v_reasons := array_append(v_reasons, 'similar_title');
    end if;

    -- distinctive words: IDF-weighted share of the smaller listing's words
    v_c_toks := public.match_tokens(c.title || ' ' || coalesce(c.description, ''));
    select coalesce(sum(coalesce(m.idf, v_max_idf)), 0) into v_c_w
    from unnest(v_c_toks) t left join public.match_term_idf m on m.term = t;
    select coalesce(sum(coalesce(m.idf, v_max_idf)), 0) into v_shared
    from unnest(v_toks) t left join public.match_term_idf m on m.term = t
    where t = any (v_c_toks);
    v_words := case when least(v_toks_w, v_c_w) > 0 then v_shared / least(v_toks_w, v_c_w) else 0 end;
    if v_words > 0.1 then
      v_score := v_score + 20 * least(1, (v_words - 0.1) / 0.4);
      if v_words >= 0.25 then
        v_desc_hit := true;
      end if;
    end if;

    -- colour agreement / contradiction
    select coalesce(array_agg(distinct mc.group_key), '{}') into v_c_colors
    from unnest(v_c_toks) t join public.match_colors mc on mc.term_fold = t;
    if cardinality(v_colors) > 0 and cardinality(v_c_colors) > 0 then
      if v_colors && v_c_colors then
        v_score := v_score + 8;
        v_desc_hit := true;
      else
        v_score := v_score - 12;
      end if;
    end if;

    if v_desc_hit then
      v_reasons := array_append(v_reasons, 'similar_description');
    end if;

    if v_item.city is not null and c.city is not null then
      if v_item.city = c.city then
        v_score := v_score + 10;
        v_reasons := array_append(v_reasons, 'same_city');
      else
        v_score := v_score - 15;
      end if;
    end if;

    -- Points only, no reason label: the shipped mobile app maps a fixed set
    -- of reason codes (MatchReason) and an unknown one would render blank.
    if v_item.location_type is not null and v_item.location_type = c.location_type then
      v_score := v_score + 5;
    end if;

    if v_gap is not null and v_gap <= 30 then
      v_score := v_score + 15 * (1 - greatest(v_gap, 0) / 30.0);
      if abs(v_gap) <= 7 then
        v_reasons := array_append(v_reasons, 'similar_date');
      end if;
    end if;

    v_score := round(greatest(0, least(100, v_score)));

    if v_score >= 40 then
      insert into public.item_matches (lost_item_id, found_item_id, score, reasons)
      values (v_lost, v_found, v_score, v_reasons)
      on conflict (lost_item_id, found_item_id)
      do update set score = excluded.score, reasons = excluded.reasons;
      v_keep := array_append(v_keep, c.id);
    end if;
  end loop;

  -- pairs that no longer reach the cut-off (edited, re-scored) go away
  delete from public.item_matches m
  where (m.lost_item_id = p_item_id and m.found_item_id <> all (v_keep))
     or (m.found_item_id = p_item_id and m.lost_item_id <> all (v_keep));
end;
$$;

revoke all on function public.run_ai_matching_for_item(uuid) from public, anon, authenticated;

-- Initial statistics + backfill without pushes.
select public.refresh_match_term_idf();
select set_config('juyo.suppress_match_push', 'on', true);
select public.admin_backfill_ai_matches();
select set_config('juyo.suppress_match_push', 'off', true);

-- Nightly: refresh word stats, re-score everything (date decay, new words).
-- cron.schedule is an upsert by name.
select cron.schedule(
  'rescore-ai-matches',
  '30 2 * * *',
  $cron$select public.refresh_match_term_idf(); select public.admin_backfill_ai_matches();$cron$
);

notify pgrst, 'reload schema';
