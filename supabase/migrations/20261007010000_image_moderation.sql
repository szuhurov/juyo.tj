-- Image moderation (weapons) without any server-side AI.
--
-- Depends on 20261007000000_visual_search.sql: the score is computed HERE, in
-- the database, from the DINOv2 vector that the poster's device (or the
-- admin's browser) already sends for visual search. A device never sends a
-- score, so a modified client cannot send a "safe" score; it can only send a
-- wrong vector, which the admin's browser replaces at review (author_match).
--
-- Owner decisions 2026-10-07:
--   * AI speeds up the admin, it never replaces them. Nothing is published
--     without an admin: SAFE only puts a listing into the "safe" list, where
--     the admin approves it (one click for many).
--   * REVIEW: shown to the admin with the reason ("weapon?", "knife?").
--   * BLOCK: auto-reject only at very high confidence (threshold chosen on the
--     benchmark for precision ≥ 99 % with no false positive on validation);
--     the admin can undo it.
--   * Knives count like firearms. Nudity and gore have no model yet: the
--     admin checks them by eye (stated in the admin UI).
--
-- Model, data and thresholds: Web/tools/moderation-bench (RESULTS.md).
-- Moderation data is admin-only: RLS on, no policies, no grants.

-- ── Versioned moderation model: one row per (head file, policy) ──────────
create table if not exists public.moderation_models (
  id text primary key,
  visual_model_id text not null references public.visual_models(id),
  -- sha256 of the head JSON in Web/tools/moderation-bench/out (weights + thresholds)
  head_sha256 text not null check (head_sha256 ~ '^[0-9a-f]{64}$'),
  policy_version text not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.moderation_models enable row level security;
revoke all on public.moderation_models from anon, authenticated;
-- At most one active model per visual model.
create unique index if not exists moderation_models_one_active
  on public.moderation_models (visual_model_id) where active;

-- One logistic head per category: p = sigmoid(w·x + b) on the L2-normalised vector.
create table if not exists public.moderation_heads (
  model_id text not null references public.moderation_models(id) on delete cascade,
  category text not null check (category in ('firearm', 'blade')),
  weights vector not null,
  bias real not null,
  -- p ≥ t_review → REVIEW; p ≥ t_block → BLOCK (null: never block for this category)
  t_review real not null check (t_review > 0 and t_review < 1),
  t_block real check (t_block is null or (t_block > t_review and t_block < 1)),
  primary key (model_id, category)
);
alter table public.moderation_heads enable row level security;
revoke all on public.moderation_heads from anon, authenticated;

create table if not exists public.image_moderation (
  image_id uuid not null references public.item_images(id) on delete cascade,
  model_id text not null references public.moderation_models(id),
  item_id uuid not null references public.items(id) on delete cascade,
  -- whose vector: the poster's device, the admin's browser, or a backfill
  source text not null check (source in ('author', 'admin', 'backfill')),
  scores jsonb not null,
  decision text not null check (decision in ('safe', 'review', 'block')),
  reasons text[] not null default '{}',
  computed_at timestamptz not null default now(),
  primary key (image_id, model_id)
);
alter table public.image_moderation enable row level security;
revoke all on public.image_moderation from anon, authenticated;
create index if not exists image_moderation_item on public.image_moderation (item_id);

-- ── Scoring ───────────────────────────────────────────────────────────────
create or replace function public.moderation_score(p_model text, p_embedding vector)
returns table (scores jsonb, decision text, reasons text[])
language sql stable security definer set search_path = public as $$
  with s as (
    select h.category,
           (1 / (1 + exp(-((-(p_embedding <#> h.weights)) + h.bias))))::real as p,
           h.t_review, h.t_block
      from public.moderation_heads h
     where h.model_id = p_model
  )
  select jsonb_object_agg(category, round(p::numeric, 5)),
         case when bool_or(t_block is not null and p >= t_block) then 'block'
              when bool_or(p >= t_review) then 'review'
              else 'safe' end,
         coalesce(array_agg(category order by category) filter (where p >= t_review), '{}')
    from s;
$$;
revoke all on function public.moderation_score(text, vector) from public, anon, authenticated;

-- enforce_moderation_status() lets only the service role change
-- moderation_status. The moderation trigger below runs inside the poster's
-- own request (set_image_embedding), so it marks itself with a transaction-
-- local setting that clients cannot set (PostgREST exposes no set_config).
create or replace function public.enforce_moderation_status()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_privileged boolean;
  v_content_changed boolean;
begin
  v_privileged := (
    current_setting('request.jwt.claims', true) is null
    or (current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role'
    or current_setting('juyo.moderation_engine', true) = 'on'
  );

  if v_privileged then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    new.moderation_status := 'pending';
    new.moderation_result := null;
    return new;
  end if;

  if new.moderation_status is distinct from old.moderation_status then
    if new.moderation_status = 'pending' then
      new.moderation_result := null;
    else
      new.moderation_status := old.moderation_status;
      new.moderation_result := old.moderation_result;
    end if;
    return new;
  end if;

  v_content_changed := (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.category is distinct from old.category
  );

  if v_content_changed and old.moderation_status <> 'pending' then
    new.moderation_status := 'pending';
    new.moderation_result := null;
  end if;

  return new;
end;
$function$;

-- Every vector written for a photo (author, admin or backfill) is scored by
-- the active moderation model of that visual model. A BLOCK on the poster's
-- own vector rejects a listing that is still pending; the admin can undo it.
create or replace function public.moderate_image_embedding()
returns trigger
language plpgsql volatile security definer set search_path = public as $$
declare
  v_model text;
  r record;
begin
  select id into v_model from public.moderation_models
   where visual_model_id = new.model_id and active;
  if v_model is null then
    return new;
  end if;

  select * into r from public.moderation_score(v_model, new.embedding);
  if r.decision is null then
    return new;
  end if;

  insert into public.image_moderation (image_id, model_id, item_id, source, scores, decision, reasons)
  values (new.image_id, v_model, new.item_id, new.source, r.scores, r.decision, r.reasons)
  on conflict (image_id, model_id) do update
     set source = excluded.source, scores = excluded.scores, decision = excluded.decision,
         reasons = excluded.reasons, computed_at = now();

  -- Only the poster's vector at submission rejects: an admin who undid a
  -- rejection must not see it come back when their browser re-scores.
  if r.decision = 'block' and new.source = 'author' then
    perform set_config('juyo.moderation_engine', 'on', true);
    update public.items
       set moderation_status = 'rejected',
           -- the apps show this key to the poster (translations: mod_weapon); the
           -- scores and the model id stay in image_moderation
           moderation_result = 'mod_weapon'
     where id = new.item_id and moderation_status = 'pending';
    perform set_config('juyo.moderation_engine', 'off', true);
  end if;
  return new;
end;
$$;
revoke all on function public.moderate_image_embedding() from public, anon, authenticated;

drop trigger if exists image_embeddings_moderate on public.image_embeddings;
create trigger image_embeddings_moderate
  after insert or update of embedding on public.image_embeddings
  for each row execute function public.moderate_image_embedding();

-- ── Admin: the "safe" list and approving it in one go ─────────────────────
-- Candidates: pending, not deleted, not a document/card category, with at
-- least one photo, and every current photo scored SAFE by the active model.
-- `admin_checked` is true only when every photo's score comes from a vector
-- the admin's browser computed (the poster's own vector is not trusted for
-- approval).
create or replace function public.admin_safe_candidates(p_limit int default 50)
returns table (item_id uuid, updated_at timestamptz, admin_checked boolean)
language sql stable security definer set search_path = public as $$
  select i.id, i.updated_at,
         bool_and(m.source in ('admin', 'backfill'))
    from public.items i
    join public.item_images ii on ii.item_id = i.id
    left join public.moderation_models mm on mm.active
    left join public.image_moderation m on m.image_id = ii.id and m.model_id = mm.id
   where i.moderation_status = 'pending'
     and (i.status is null or i.status <> 'deleted')
     and i.deleted_at is null
     and i.category not in ('Documents', 'Cards')
   group by i.id, i.updated_at
  having bool_and(m.decision = 'safe')
   order by i.created_at
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
revoke all on function public.admin_safe_candidates(int) from public, anon, authenticated;

-- Approves exactly the listings the admin saw: each one must still be pending,
-- unchanged since the list was loaded (updated_at), outside Documents/Cards,
-- and every current photo scored SAFE from the admin's own vector.
-- Returns the ids that were approved; anything else is left untouched.
create or replace function public.admin_bulk_approve(p_items jsonb, p_admin text)
returns setof uuid
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_admin is null or length(p_admin) = 0 then
    raise exception 'admin_required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'bad_items' using errcode = '22023';
  end if;

  return query
  with wanted as (
    select (x ->> 'id')::uuid as id, (x ->> 'updated_at')::timestamptz as seen
      from jsonb_array_elements(p_items) x
  ),
  ok as (
    select c.item_id
      from public.admin_safe_candidates(100) c
      join wanted w on w.id = c.item_id
     where c.admin_checked
       and date_trunc('milliseconds', c.updated_at) = date_trunc('milliseconds', w.seen)
  )
  update public.items i
     set moderation_status = 'approved',
         moderation_result = 'approved_bulk_safe:' || p_admin
    from ok
   where i.id = ok.item_id and i.moderation_status = 'pending'
  returning i.id;
end;
$$;
revoke all on function public.admin_bulk_approve(jsonb, text) from public, anon, authenticated;
