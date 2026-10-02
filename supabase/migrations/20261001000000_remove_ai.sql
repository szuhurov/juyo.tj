-- ============================================================================
-- JUYO no longer uses AI anywhere (owner decision, 2026-10-01: App Store
-- 5.1.2(i) and the product direction). Before this, the database itself
-- sent every new/edited listing to OpenAI (on_item_created_moderate →
-- image-moderation Edge Function), photo search compared OpenAI embeddings
-- (match_item_images), and "possible matches" used embedding similarity as
-- one of its scores.
--
-- After this migration:
--   * listings are moderated by an admin: every client insert/content edit is
--     already forced to 'pending' (enforce_moderation_status) and the admin is
--     pushed (on_item_inserted_pending_notify_admin). Trusted posters
--     (profiles.moderation_exempt) are still auto-approved — that part of the
--     old trigger is kept, without the AI call.
--   * photo search is gone (match_item_images dropped).
--   * possible matches stay, scored only from listing data (words, title,
--     colour, city, place, date) — rules, no AI. The 35 points the image
--     similarity used to give are spread over the other signals (x 100/65), so
--     the cut-offs (store >= 40, show >= 50, push >= 65) keep their meaning.
--     Function/table names keep "ai" only because the shipped mobile builds
--     call them by name (get_my_ai_match_notifications, item_matches…).
--   * item_images.embedding (OpenAI vectors) and
--     app_settings.ai_moderation_enabled are dropped.
--
-- Older mobile builds read ai_moderation_enabled; without the column their
-- query returns nothing and they take their non-AI path (listing stays
-- pending) — nothing breaks.
--
-- DESTRUCTIVE: the embedding vectors are deleted (derived data, regenerable
-- only by AI, which no longer exists). Everything else is function/trigger DDL.
-- Rollback: re-run 20260803010000 (trigger_image_moderation + trigger),
-- 20260930000012 (image trigger), 20260930000014 (scoring), baseline
-- match_item_images, and re-add the two columns (vectors cannot come back).
-- ============================================================================

-- 1. No AI moderation call from the database -------------------------------
drop trigger if exists on_item_created_moderate on public.items;
drop function if exists public.trigger_image_moderation();

create or replace function public.auto_approve_trusted_poster()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.moderation_status is distinct from 'pending' then
    return new;
  end if;
  if exists (select 1 from public.profiles where id = NEW.user_id and moderation_exempt is true) then
    update public.items
    set moderation_status = 'approved', moderation_result = 'Auto-approved (trusted poster)'
    where id = NEW.id;
  end if;
  return new;
end;
$$;

-- Only new listings and content edits — a listing sent back to 'pending' by
-- user reports (20261001000001) must wait for the admin, even for a trusted poster.
drop trigger if exists auto_approve_trusted_poster_trigger on public.items;
create trigger auto_approve_trusted_poster_trigger
  after insert or update of title, description, category on public.items
  for each row execute function public.auto_approve_trusted_poster();

-- 2. No photo search / embeddings -----------------------------------------
drop trigger if exists trg_ai_matching_on_image_embedding on public.item_images;
drop function if exists public.trigger_run_ai_matching_from_image();
-- Every overload (the signature changed across migrations).
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'match_item_images'
  loop
    execute 'drop function ' || f;
  end loop;
end;
$$;

-- 3. Possible matches without the image signal -----------------------------
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

    if c.category <> v_item.category
       and not (least(c.category, v_item.category) = 'Electronics' and greatest(c.category, v_item.category) = 'Phone') then
      v_score := v_score - 5;
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

    if v_item.location_type is not null and v_item.location_type = c.location_type then
      v_score := v_score + 5;
    end if;

    if v_gap is not null and v_gap <= 30 then
      v_score := v_score + 15 * (1 - greatest(v_gap, 0) / 30.0);
      if abs(v_gap) <= 7 then
        v_reasons := array_append(v_reasons, 'similar_date');
      end if;
    end if;

    -- The image signal (35 of 100) is gone: scale the remaining 65 up.
    v_score := round(greatest(0, least(100, v_score * 100.0 / 65)));

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

-- 4. Drop the AI-only data ------------------------------------------------
alter table public.item_images drop column if exists embedding;
alter table public.app_settings drop column if exists ai_moderation_enabled;
-- AI output stored by the (out-of-repo) listing importer.
alter table public.external_items drop column if exists ai_confidence;

-- Re-score existing pairs without the image signal, no pushes.
select set_config('juyo.suppress_match_push', 'on', true);
select public.admin_backfill_ai_matches();
select set_config('juyo.suppress_match_push', 'off', true);

notify pgrst, 'reload schema';
