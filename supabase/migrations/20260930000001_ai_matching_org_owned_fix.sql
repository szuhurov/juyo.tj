-- ============================================================================
-- Phase 7 — Absolute Final Gap Closure: fix a genuine AI Matching bug
-- discovered while verifying organization-owned FOUND item compatibility
-- with run_ai_matching_for_item (20260924000000_ai_matching.sql). This is
-- a direct, minimal fix for a Phase 7 integration bug, NOT an AI Matching
-- algorithm redesign — every weight/threshold/signal is left untouched.
--
-- THE BUG: the candidate filter used `i.user_id <> v_item.user_id` to
-- avoid matching a user against their own post. Organization-owned items
-- (Phase 7, 20260929000000) have user_id = NULL by design. In SQL,
-- `NULL <> anything` (and `anything <> NULL`) evaluates to NULL, which a
-- WHERE clause treats as "exclude this row" — NOT "these differ, include
-- it". The practical effect:
--   1. An organization-owned FOUND item was NEVER selected as a candidate
--      when scoring any other item (i.user_id <> v_item.user_id was NULL
--      for every row where i.user_id is null).
--   2. When an organization-owned FOUND item's own approval fired the
--      trigger (v_item.user_id is null), i.user_id <> NULL was NULL for
--      EVERY candidate row, so the loop matched nothing at all.
-- Net effect: organization-owned FOUND posts silently never entered the
-- matching pool in either direction — despite the Phase 7 item-routing
-- migration's stated intent that they "participate in the existing
-- matching pool exactly like [any other] item."
--
-- THE FIX: `is distinct from` — SQL's null-safe inequality — replaces the
-- bare `<>`. NULL IS DISTINCT FROM 'user-123' is TRUE (correctly allows
-- an org item to be matched against a personal item); NULL IS DISTINCT
-- FROM NULL is FALSE (would exclude two org-owned items from matching
-- each other, but since matching only crosses opposite `type` and
-- organizations currently only create 'found' items, this never arises
-- in practice — documented, not a masked gap).
-- ============================================================================

create or replace function public.run_ai_matching_for_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item items%rowtype;
  v_candidate record;
  v_score numeric;
  v_reasons text[];
  v_title_sim double precision;
  v_desc_sim double precision;
  v_image_sim double precision;
  v_date_diff int;
  v_lost_id uuid;
  v_found_id uuid;
begin
  select * into v_item
  from public.items
  where id = p_item_id
    and moderation_status = 'approved'
    and is_resolved = false
    and (status is null or status <> 'deleted');

  if not found then
    return; -- not (or no longer) eligible — nothing to match
  end if;

  for v_candidate in
    select i.id, i.title, i.description, i.city, i.date, i.user_id
    from public.items i
    where i.type <> v_item.type          -- opposite type only: lost <-> found
      and i.category = v_item.category   -- hard filter — a different category is never a match
      and i.id <> v_item.id
      and i.user_id is distinct from v_item.user_id  -- never match a user against their own post (null-safe — see migration header)
      and i.moderation_status = 'approved'
      and i.is_resolved = false
      and (i.status is null or i.status <> 'deleted')
  loop
    v_reasons := array['same_category'];
    v_score := 15;

    v_title_sim := similarity(coalesce(v_item.title, ''), coalesce(v_candidate.title, ''));
    if v_title_sim > 0.2 then
      v_score := v_score + least(25, v_title_sim * 25 / 0.6);
      v_reasons := array_append(v_reasons, 'similar_title');
    end if;

    v_desc_sim := similarity(coalesce(v_item.description, ''), coalesce(v_candidate.description, ''));
    if v_desc_sim > 0.15 then
      v_score := v_score + least(10, v_desc_sim * 10 / 0.5);
      v_reasons := array_append(v_reasons, 'similar_description');
    end if;

    -- Best-pair image cosine similarity — same `1 - (a <=> b)` distance-to-
    -- similarity conversion as match_item_images (visual-search).
    select max(1 - (a.embedding <=> b.embedding))
    into v_image_sim
    from public.item_images a
    join public.item_images b on true
    where a.item_id = v_item.id
      and b.item_id = v_candidate.id
      and a.embedding is not null
      and b.embedding is not null;

    if v_image_sim is not null and v_image_sim > 0.75 then
      v_score := v_score + least(30, (v_image_sim - 0.75) * 30 / 0.2);
      v_reasons := array_append(v_reasons, 'similar_image');
    end if;

    if v_item.city = v_candidate.city then
      v_score := v_score + 10;
      v_reasons := array_append(v_reasons, 'same_city');
    end if;

    v_date_diff := abs(v_item.date - v_candidate.date);
    if v_date_diff <= 14 then
      v_score := v_score + (10.0 * (14 - v_date_diff) / 14.0);
      if v_date_diff <= 7 then
        v_reasons := array_append(v_reasons, 'similar_date');
      end if;
    end if;

    v_score := round(least(v_score, 100));

    if v_score >= 40 then
      if v_item.type = 'lost' then
        v_lost_id := v_item.id;
        v_found_id := v_candidate.id;
      else
        v_lost_id := v_candidate.id;
        v_found_id := v_item.id;
      end if;

      insert into public.item_matches (lost_item_id, found_item_id, score, reasons)
      values (v_lost_id, v_found_id, v_score, v_reasons)
      on conflict (lost_item_id, found_item_id) do nothing;
    end if;
  end loop;
end;
$$;

-- Grants are unchanged by create or replace, but restated for clarity/audit
-- — same service_role-only reasoning as the original migration.
revoke execute on function public.run_ai_matching_for_item(uuid) from public, anon, authenticated;
grant execute on function public.run_ai_matching_for_item(uuid) to service_role;

-- ============================================================================
-- Rollback (not executed — reference only): re-create the function with the
-- original `i.user_id <> v_item.user_id` filter (see 20260924000000_ai_matching.sql).
-- ============================================================================
