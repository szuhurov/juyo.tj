-- ============================================================================
-- Phase 5 — AI Matching (LOST <-> FOUND "Possible Match").
--
-- IMPORTANT — data residency / no new external AI call: this entire feature
-- is computed inside Postgres from data ALREADY on this database:
--   - items.category/type/city/date/title/description (never left the DB)
--   - item_images.embedding (1536-dim vectors already produced by the
--     EXISTING generate-embedding Edge Function — see docs/engineering/09,
--     already the flagged, unchanged OpenAI/US surface; this migration does
--     NOT call OpenAI, does NOT add a new external AI provider, and does NOT
--     send any additional personal data anywhere. It only reads vectors that
--     were already computed and already stored for visual-search.)
-- pg_trgm (title/description similarity) and pgvector (image similarity)
-- are both already enabled extensions (confirmed live before writing this).
--
-- Matching never declares ownership — it only ever produces a score +
-- reasons; contact/return still goes through the existing phone/Telegram/
-- WhatsApp flow on the item page, unchanged.
-- ============================================================================

create table if not exists public.item_matches (
  id             uuid primary key default gen_random_uuid(),
  lost_item_id   uuid not null references public.items(id) on delete cascade,
  found_item_id  uuid not null references public.items(id) on delete cascade,
  score          numeric(5,2) not null check (score >= 0 and score <= 100),
  reasons        text[] not null default '{}',
  created_at     timestamptz not null default now(),
  unique (lost_item_id, found_item_id)
);
create index if not exists idx_item_matches_lost on public.item_matches(lost_item_id);
create index if not exists idx_item_matches_found on public.item_matches(found_item_id);

-- RLS enabled, zero policies — same convention as dismissed_notifications/
-- notification_reads: no direct client select of this table at all (it
-- joins two different users' items, which is exactly the kind of
-- cross-user data a broad SELECT policy could leak). Every read goes
-- through a SECURITY DEFINER RPC below that decides, server-side, exactly
-- which columns of the OTHER person's item are safe to return.
alter table public.item_matches enable row level security;

-- A live-item partial index, scoped to exactly the rows run_ai_matching_for_item
-- scans as match candidates — mirrors the eligibility filter itself.
create index if not exists idx_items_ai_matching_candidates
  on public.items(category, type)
  where moderation_status = 'approved' and is_resolved = false and (status is null or status <> 'deleted');

-- ============================================================================
-- The scorer. Runs for ONE newly-(re)approved item against the opposite-type
-- pool. Because a pair (L, F) only ever gets scored when the SECOND of the
-- two gets approved (the first approval couldn't have seen a not-yet-posted
-- item), every eligible pair is scored exactly once — no separate dedup
-- sweep is needed beyond the unique constraint + ON CONFLICT DO NOTHING.
--
-- Weights (sum to 100 when every signal is fully present):
--   same category (hard filter, required)   15
--   title trigram similarity                25
--   description trigram similarity          10
--   best-pair image cosine similarity       30
--   same city                               10
--   date proximity (within 14 days)         10
-- Below SCORE_FLOOR (40) a pair isn't stored at all — a bare "same
-- category, nothing else in common" pair is noise, not a possible match.
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
      and i.user_id <> v_item.user_id    -- never match a user against their own post
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

-- No internal identity check (it scores an arbitrary item_id against the
-- whole opposite-type pool, which is fine for a trigger/admin call but
-- would be an expensive, unrestricted, client-triggerable write to
-- item_matches if left at Postgres's default PUBLIC execute grant — so
-- unlike the Phase 4 RPCs (which self-gate via get_auth_id()), this one is
-- explicitly locked to service_role only. It's still reachable from the
-- trigger below regardless of grants — a function body calling another
-- function is not subject to the EXECUTE-grant check that applies to a
-- role invoking it directly (e.g. over PostgREST).
revoke execute on function public.run_ai_matching_for_item(uuid) from public, anon, authenticated;
grant execute on function public.run_ai_matching_for_item(uuid) to service_role;

create or replace function public.trigger_run_ai_matching()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.run_ai_matching_for_item(new.id);
  return new;
end;
$$;

-- Same INSERT/UPDATE split as trigger_notify_category_post (an INSERT
-- trigger's WHEN clause can't reference OLD).
drop trigger if exists on_item_inserted_approved_ai_matching on public.items;
create trigger on_item_inserted_approved_ai_matching
  after insert on public.items
  for each row
  when (new.moderation_status = 'approved')
  execute function public.trigger_run_ai_matching();

drop trigger if exists on_item_updated_approved_ai_matching on public.items;
create trigger on_item_updated_approved_ai_matching
  after update on public.items
  for each row
  when (new.moderation_status = 'approved' and old.moderation_status is distinct from 'approved')
  execute function public.trigger_run_ai_matching();

-- ============================================================================
-- Push notification on a strong new match (score >= 70) — reuses the exact
-- net.http_post-from-trigger pattern as trigger_notify_category_post
-- (20260715000000_notify_category_and_qr_scan.sql). The actual Edge
-- Function (notify-ai-match) is deployed separately; it fans out to BOTH
-- item owners and reuses the Phase 4 quiet-hours/daily-cap logic.
-- ============================================================================
create or replace function public.trigger_notify_ai_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'service_role_key_for_triggers';

  perform net.http_post(
    url := 'https://aztuszloghjkynukjkaa.supabase.co/functions/v1/notify-ai-match',
    headers := jsonb_build_object('Content-type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object('match_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists on_item_match_inserted_notify on public.item_matches;
create trigger on_item_match_inserted_notify
  after insert on public.item_matches
  for each row
  when (new.score >= 70)
  execute function public.trigger_notify_ai_match();

-- ============================================================================
-- Reads — both folded into SECURITY DEFINER RPCs (never a direct client
-- select of item_matches), same reasoning as dismissed_notifications: this
-- table's rows span two different users' items, so the RPC decides exactly
-- which fields of "the other side" are safe to expose (first_name/
-- last_name/avatar_url — the same public_profiles-shaped fields
-- get_my_category_notifications already exposes; never phone/email).
-- ============================================================================

-- Every possible match the caller is a party to (as either side), for a
-- dedicated "Possible Matches" list. Excludes anything the caller already
-- dismissed, and excludes matches where either item is no longer live
-- (deleted/resolved/un-approved since the match was computed) — computed
-- live at read time rather than kept in sync by extra triggers.
create or replace function public.get_my_possible_matches(p_limit int default 30)
returns table (
  match_id uuid,
  my_item_id uuid,
  my_item_title text,
  my_item_type item_type,
  other_item_id uuid,
  other_item_title text,
  other_item_type item_type,
  other_item_image_url text,
  other_poster_id text,
  other_poster_first_name text,
  other_poster_last_name text,
  other_poster_avatar_url text,
  score numeric,
  reasons text[],
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid text := get_auth_id();
begin
  if v_uid is null then
    return;
  end if;

  return query
  select
    m.id,
    case when li.user_id = v_uid then li.id else fi.id end,
    case when li.user_id = v_uid then li.title else fi.title end,
    case when li.user_id = v_uid then li.type else fi.type end,
    case when li.user_id = v_uid then fi.id else li.id end,
    case when li.user_id = v_uid then fi.title else li.title end,
    case when li.user_id = v_uid then fi.type else li.type end,
    case when li.user_id = v_uid then fimg.image_url else limg.image_url end,
    case when li.user_id = v_uid then fi.user_id else li.user_id end,
    case when li.user_id = v_uid then fp.first_name else lp.first_name end,
    case when li.user_id = v_uid then fp.last_name else lp.last_name end,
    case when li.user_id = v_uid then fp.avatar_url else lp.avatar_url end,
    m.score,
    m.reasons,
    m.created_at
  from public.item_matches m
  join public.items li on li.id = m.lost_item_id
  join public.items fi on fi.id = m.found_item_id
  join public.profiles lp on lp.id = li.user_id
  join public.profiles fp on fp.id = fi.user_id
  left join lateral (
    select ii.image_url from public.item_images ii where ii.item_id = li.id order by ii.created_at asc limit 1
  ) limg on true
  left join lateral (
    select ii.image_url from public.item_images ii where ii.item_id = fi.id order by ii.created_at asc limit 1
  ) fimg on true
  where (li.user_id = v_uid or fi.user_id = v_uid)
    and li.moderation_status = 'approved' and li.is_resolved = false and (li.status is null or li.status <> 'deleted')
    and fi.moderation_status = 'approved' and fi.is_resolved = false and (fi.status is null or fi.status <> 'deleted')
    and not exists (
      select 1 from public.dismissed_notifications d
      where d.user_id = v_uid and d.kind = 'ai_match' and d.ref_id = m.id
    )
  order by m.score desc, m.created_at desc
  limit p_limit;
end;
$$;

grant execute on function public.get_my_possible_matches(int) to authenticated;

-- The notification-feed shape (score >= 70 only — "sufficiently strong"),
-- plugged into the Phase 4 architecture: reuses dismissed_notifications
-- (kind='ai_match') and notification_reads (kind='ai_match', widened below)
-- exactly like category_post/expiry_confirm.
create or replace function public.get_my_ai_match_notifications(p_limit int default 20)
returns table (
  match_id uuid,
  other_item_id uuid,
  other_item_title text,
  other_item_type item_type,
  other_item_image_url text,
  my_item_id uuid,
  my_item_title text,
  score numeric,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid text := get_auth_id();
begin
  if v_uid is null then
    return;
  end if;

  return query
  select
    m.id,
    case when li.user_id = v_uid then fi.id else li.id end,
    case when li.user_id = v_uid then fi.title else li.title end,
    case when li.user_id = v_uid then fi.type else li.type end,
    case when li.user_id = v_uid then fimg.image_url else limg.image_url end,
    case when li.user_id = v_uid then li.id else fi.id end,
    case when li.user_id = v_uid then li.title else fi.title end,
    m.score,
    m.created_at
  from public.item_matches m
  join public.items li on li.id = m.lost_item_id
  join public.items fi on fi.id = m.found_item_id
  left join lateral (
    select ii.image_url from public.item_images ii where ii.item_id = li.id order by ii.created_at asc limit 1
  ) limg on true
  left join lateral (
    select ii.image_url from public.item_images ii where ii.item_id = fi.id order by ii.created_at asc limit 1
  ) fimg on true
  where (li.user_id = v_uid or fi.user_id = v_uid)
    and m.score >= 70
    and li.moderation_status = 'approved' and li.is_resolved = false and (li.status is null or li.status <> 'deleted')
    and fi.moderation_status = 'approved' and fi.is_resolved = false and (fi.status is null or fi.status <> 'deleted')
    and not exists (
      select 1 from public.dismissed_notifications d
      where d.user_id = v_uid and d.kind = 'ai_match' and d.ref_id = m.id
    )
  order by m.created_at desc
  limit p_limit;
end;
$$;

grant execute on function public.get_my_ai_match_notifications(int) to authenticated;

-- ============================================================================
-- Admin backfill — items approved BEFORE this migration never fired the new
-- trigger, so without this they'd never get matched at all. Same
-- service_role-only reasoning as run_ai_matching_for_item (no internal
-- identity check, so the default PUBLIC grant must be revoked explicitly).
-- Called once from an admin-gated API route (Clerk allowlist), same shape
-- as the existing reprocess-embeddings admin action.
-- ============================================================================
create or replace function public.admin_backfill_ai_matches()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_count integer := 0;
begin
  for v_item in
    select id from public.items
    where moderation_status = 'approved'
      and is_resolved = false
      and (status is null or status <> 'deleted')
  loop
    perform public.run_ai_matching_for_item(v_item.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.admin_backfill_ai_matches() from public, anon, authenticated;
grant execute on function public.admin_backfill_ai_matches() to service_role;

-- ============================================================================
-- Wire the new 'ai_match' kind into the Phase 4 notification architecture.
-- ============================================================================
alter table public.dismissed_notifications drop constraint dismissed_notifications_kind_check;
alter table public.dismissed_notifications add constraint dismissed_notifications_kind_check
  check (kind in ('verification', 'category_post', 'ai_match'));

alter table public.notification_reads drop constraint notification_reads_kind_check;
alter table public.notification_reads add constraint notification_reads_kind_check
  check (kind in ('category_post', 'expiry_confirm', 'ai_match'));

create or replace function public.dismiss_notification(
  p_kind text,
  p_ref_id uuid,
  p_item_id uuid,
  p_item_title text,
  p_related_name text,
  p_related_avatar text,
  p_status text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_kind not in ('verification', 'category_post', 'ai_match') then
    raise exception 'Invalid kind';
  end if;

  insert into dismissed_notifications (user_id, kind, ref_id)
  values (v_user_id, p_kind, p_ref_id)
  on conflict (user_id, kind, ref_id) do nothing;

  insert into deleted_notifications_archive
    (user_id, kind, ref_id, item_id, item_title, related_name, related_avatar, status)
  values
    (v_user_id, p_kind, p_ref_id, p_item_id, p_item_title, p_related_name, p_related_avatar, p_status);
end;
$$;

create or replace function public.mark_notification_read(p_kind text, p_ref_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_kind not in ('category_post', 'expiry_confirm', 'ai_match') then
    raise exception 'Invalid kind';
  end if;

  insert into notification_reads (user_id, kind, ref_id)
  values (v_user_id, p_kind, p_ref_id)
  on conflict (user_id, kind, ref_id) do nothing;
end;
$$;

create or replace function public.mark_notifications_read(p_kinds text[], p_ref_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if array_length(p_kinds, 1) is null then
    return;
  end if;
  if array_length(p_kinds, 1) <> array_length(p_ref_ids, 1) then
    raise exception 'p_kinds and p_ref_ids must be the same length';
  end if;
  if exists (select 1 from unnest(p_kinds) k where k not in ('category_post', 'expiry_confirm', 'ai_match')) then
    raise exception 'Invalid kind';
  end if;

  insert into notification_reads (user_id, kind, ref_id)
  select v_user_id, k, r
  from unnest(p_kinds, p_ref_ids) as t(k, r)
  on conflict (user_id, kind, ref_id) do nothing;
end;
$$;
