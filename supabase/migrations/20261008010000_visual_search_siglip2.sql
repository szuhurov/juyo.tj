-- Visual search v2 (owner approval 2026-10-08): SigLIP 2 B/16 @256 replaces
-- DINOv2-S as the model new app builds and the website compute on the device.
-- Chosen on a real multi-view benchmark (another photo of the same object):
-- R@1 98.6 % vs 88.4 % — Web/tools/visual-bench/RESULTS-instance.md.
--
-- 1. New row in visual_models + its own partial HNSW index (768-d). The
--    DINOv2 row stays ACTIVE: app builds made before this release still
--    compute DINOv2 vectors (set_image_embedding, /api/search/image accept
--    both); every query is only compared with vectors of its own model.
-- 2. Photos count again in lost <-> found matching (the 35-point image signal
--    removed with the AI on 2026-10-01), from the on-device vectors only.
-- 3. Matching re-runs when a listing's vector arrives (vectors come after the
--    listing row: the poster's device, then the admin's browser at review).
--
-- Rollback: delete the new model's image_embeddings rows and its visual_models
-- row, drop the index, the trigger, trigger_run_ai_matching_from_embedding and
-- item_photo_similarity, and re-create run_ai_matching_for_item from
-- 20261001000000_remove_ai.sql. Clients keep working on the DINOv2 row.

-- ── 1. Model ─────────────────────────────────────────────────────────────
-- Thresholds = cosine at 5 % / 1 % false positives among 2 376 same-category
-- different-object pairs; weights = logistic fit on 216 positives vs 18 792
-- negatives (fit-instance.ts, global method).
insert into public.visual_models
  (id, name, model_sha256, preprocess_version, dim, t_similar, t_very_similar, w_cos, w_phash, w_bias, active)
values
  ('siglip2-b16-256-q4.squash-area-v1', 'SigLIP 2 B/16 256 (onnx-community vision q4)',
   '712064dae0cce3fb4c94497c7dfd65d11f4ad34eadafe09442208474068cf777',
   'squash256-area-half-v1', 768, 0.798, 0.8394, 13.265, 1.434, -9.856, true)
on conflict (id) do nothing;

create index if not exists image_embeddings_hnsw_siglip2_b16_256_q4_v1
  on public.image_embeddings using hnsw ((embedding::vector(768)) vector_cosine_ops)
  where model_id = 'siglip2-b16-256-q4.squash-area-v1';

-- ── 2. Photo similarity of two listings ──────────────────────────────────
-- Best cosine over all photo pairs of the two listings, in the newest active
-- model both have vectors for, with that model's thresholds.
create or replace function public.item_photo_similarity(p_a uuid, p_b uuid)
returns table (cos real, t_similar real, t_very_similar real)
language sql stable security definer set search_path = public as $$
  select x.cos, m.t_similar, m.t_very_similar
    from public.visual_models m
    cross join lateral (
      select max(1 - (a.embedding <=> b.embedding))::real as cos
        from public.image_embeddings a
        join public.image_embeddings b on b.model_id = a.model_id
       where a.item_id = p_a and b.item_id = p_b and a.model_id = m.id
    ) x
   where m.active and x.cos is not null
   order by m.created_at desc
   limit 1;
$$;
revoke all on function public.item_photo_similarity(uuid, uuid) from public, anon, authenticated;

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
  v_text numeric;
  v_cos real;
  v_t_similar real;
  v_t_very real;
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

    -- Text, place and date are worth 65 and are scaled to 100 when photos
    -- give no evidence. Photos (35): both listings have vectors of the same
    -- model and they are at least "similar" (5 % false positives among
    -- different objects of the same category on the JUYO benchmark) — 17.5
    -- points at t_similar, rising to 35 at t_very_similar. Photo evidence
    -- only ever raises a score: a stock photo of a similar item, or a photo
    -- taken from another side, must not hide a text match.
    v_text := round(greatest(0, least(100, v_score * 100.0 / 65)));
    select s.cos, s.t_similar, s.t_very_similar into v_cos, v_t_similar, v_t_very
      from public.item_photo_similarity(v_item.id, c.id) s;
    if v_cos is not null and v_cos >= v_t_similar then
      v_score := greatest(v_text, round(greatest(0, least(100,
        v_score + 35 * (0.5 + 0.5 * least(1, (v_cos - v_t_similar) / greatest(v_t_very - v_t_similar, 0.001)))))));
      v_reasons := array_append(v_reasons, 'similar_image');
    else
      v_score := v_text;
    end if;

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

-- ── 3. Re-score when a vector arrives ────────────────────────────────────
create or replace function public.trigger_run_ai_matching_from_embedding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.run_ai_matching_for_item(new.item_id);
  return null;
end;
$$;
revoke all on function public.trigger_run_ai_matching_from_embedding() from public, anon, authenticated;

drop trigger if exists trg_ai_matching_on_visual_embedding on public.image_embeddings;
create trigger trg_ai_matching_on_visual_embedding
  after insert or update of embedding on public.image_embeddings
  for each row
  execute function public.trigger_run_ai_matching_from_embedding();

notify pgrst, 'reload schema';
