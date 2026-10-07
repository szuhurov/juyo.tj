-- Visual search ("search by photo") without any server-side AI.
--
-- The vector is made ON THE DEVICE (app: app/modules/visual-embedding,
-- web: lib/visual-search.ts) from the already-redacted photo; no photo is
-- ever uploaded to make or to search with an embedding. The database only
-- stores vectors for published listing photos and answers nearest-neighbour
-- queries.
--
-- Trust model (owner decision 2026-10-06): the poster's device writes the
-- first vector of its own new photos (set_image_embedding). An admin's
-- browser recomputes the vector from the uploaded photo when the listing is
-- reviewed and overwrites it (source 'admin', author_match records how close
-- the poster's vector was). A listing is only searchable once approved.
--
-- Embeddings are treated as personal data: RLS on, no policies, no grants to
-- anon/authenticated. Clients never read a vector. Searching goes through
-- /api/search/image (rate-limited) → search_visual(), service role only.

-- ── Versioned embedding contract ─────────────────────────────────────────
-- One row per (model file, preprocessing) pair. Vectors of different rows are
-- never compared: a model or preprocessing change is a NEW id, old vectors
-- stay until the new ones are backfilled, then the old id is deactivated.
create table if not exists public.visual_models (
  id text primary key,
  name text not null,
  model_sha256 text not null check (model_sha256 ~ '^[0-9a-f]{64}$'),
  preprocess_version text not null,
  dim int not null check (dim between 64 and 2048),
  -- all measured by Web/tools/visual-bench on real listing photos
  -- (fit-ranking.ts): relevance thresholds on cosine, and the logistic
  -- weights of visual = sigmoid(w_cos·cos + w_phash·phashSim + w_bias)
  t_similar real not null,
  t_very_similar real not null,
  w_cos real not null,
  w_phash real not null,
  w_bias real not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.visual_models enable row level security;
revoke all on public.visual_models from anon, authenticated;

create table if not exists public.image_embeddings (
  image_id uuid not null references public.item_images(id) on delete cascade,
  model_id text not null references public.visual_models(id),
  item_id uuid not null references public.items(id) on delete cascade,
  embedding vector not null,
  phash bit(64),
  source text not null check (source in ('author', 'admin', 'backfill')),
  -- cosine(author vector, admin vector) when the admin's browser recomputed it
  author_match real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (image_id, model_id)
);
alter table public.image_embeddings enable row level security;
revoke all on public.image_embeddings from anon, authenticated;
create index if not exists image_embeddings_item on public.image_embeddings (item_id);

-- ── Rate limit for search_visual (per hashed client, rolling 10 minutes) ──
-- client_hash is sha256(ip | day | server secret) computed in the API route;
-- the raw IP is never stored. Rows older than a day are purged on use.
create table if not exists public.visual_search_hits (
  client_hash text not null,
  at timestamptz not null default now()
);
alter table public.visual_search_hits enable row level security;
revoke all on public.visual_search_hits from anon, authenticated;
create index if not exists visual_search_hits_client on public.visual_search_hits (client_hash, at);
create index if not exists visual_search_hits_at on public.visual_search_hits (at);

-- ── Shared vector validation ─────────────────────────────────────────────
create or replace function public.visual_vector_ok(p_model text, p_embedding real[])
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select array_length(p_embedding, 1) = m.dim
       and not exists (
         select 1 from unnest(p_embedding) x
          where x is null or x = 'NaN'::real or x = 'Infinity'::real or x = '-Infinity'::real)
       -- device vectors are L2-normalized; anything else is not ours
       and abs(sqrt((select sum(x::float8 * x) from unnest(p_embedding) x)) - 1) < 0.01
      from public.visual_models m
     where m.id = p_model and m.active), false);
$$;
revoke all on function public.visual_vector_ok(text, real[]) from public, anon, authenticated;

-- ── Poster's device: vector for its own NEW photo ─────────────────────────
-- Only the owner of the listing, only for a photo row created in the last
-- hour (photos are new rows on every edit, and an edit sends the listing
-- back to review), and never over a vector an admin already wrote.
create or replace function public.set_image_embedding(
  p_image_id uuid, p_model text, p_embedding real[], p_phash text)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_me text := public.get_auth_id();
  v_item uuid;
  v_owner text;
  v_created timestamptz;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select ii.item_id, i.user_id, ii.created_at into v_item, v_owner, v_created
    from public.item_images ii join public.items i on i.id = ii.item_id
   where ii.id = p_image_id;
  if v_item is null or v_owner is distinct from v_me then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_created < now() - interval '1 hour' then
    raise exception 'photo_too_old' using errcode = '22023';
  end if;
  if not public.visual_vector_ok(p_model, p_embedding) then
    raise exception 'bad_vector' using errcode = '22023';
  end if;
  if p_phash is not null and p_phash !~ '^[0-9a-f]{16}$' then
    raise exception 'bad_phash' using errcode = '22023';
  end if;

  insert into public.image_embeddings (image_id, model_id, item_id, embedding, phash, source)
  values (p_image_id, p_model, v_item, p_embedding::vector,
          case when p_phash is null then null else ('x' || p_phash)::bit(64) end, 'author')
  on conflict (image_id, model_id) do update
     set embedding = excluded.embedding, phash = excluded.phash, updated_at = now()
   where public.image_embeddings.source = 'author';
end;
$$;
revoke all on function public.set_image_embedding(uuid, text, real[], text) from public, anon;
grant execute on function public.set_image_embedding(uuid, text, real[], text) to authenticated;

-- ── Admin's browser at review: the authoritative vector ──────────────────
-- Called by /api/admin/posts/[id]/embeddings (admin allowlist) with the
-- service role. Overwrites whatever the poster's device sent and records
-- how close that was, so a tampered client shows up as a low author_match.
create or replace function public.admin_set_image_embedding(
  p_image_id uuid, p_item_id uuid, p_model text, p_embedding real[], p_phash text, p_source text default 'admin')
returns real
language plpgsql volatile security definer set search_path = public as $$
declare
  v_match real;
begin
  if p_source not in ('admin', 'backfill') then
    raise exception 'bad_source' using errcode = '22023';
  end if;
  if not exists (select 1 from public.item_images where id = p_image_id and item_id = p_item_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not public.visual_vector_ok(p_model, p_embedding) then
    raise exception 'bad_vector' using errcode = '22023';
  end if;
  if p_phash is not null and p_phash !~ '^[0-9a-f]{16}$' then
    raise exception 'bad_phash' using errcode = '22023';
  end if;

  select (1 - (e.embedding <=> p_embedding::vector))::real into v_match
    from public.image_embeddings e
   where e.image_id = p_image_id and e.model_id = p_model and e.source = 'author';

  insert into public.image_embeddings (image_id, model_id, item_id, embedding, phash, source, author_match)
  values (p_image_id, p_model, p_item_id, p_embedding::vector,
          case when p_phash is null then null else ('x' || p_phash)::bit(64) end, p_source, v_match)
  on conflict (image_id, model_id) do update
     set embedding = excluded.embedding, phash = excluded.phash, source = excluded.source,
         author_match = coalesce(excluded.author_match, public.image_embeddings.author_match),
         updated_at = now();
  return v_match;
end;
$$;
revoke all on function public.admin_set_image_embedding(uuid, uuid, text, real[], text, text) from public, anon, authenticated;

-- ── Search ───────────────────────────────────────────────────────────────
-- Candidates: the 200 nearest vectors (HNSW, iterative scan so the
-- visibility filter cannot starve the result) plus every pHash near-duplicate.
-- Per listing: best cosine, best pHash. Only listings anyone may browse
-- (approved, unresolved, not deleted) are returned, at most 30, only above
-- the "similar" threshold or a pHash duplicate. Never returns a vector.
--
-- Ranking (Web/tools/visual-bench/RESULTS.md):
--   visual = sigmoid(a·cos + b·phash_sim + c), fitted on positives vs.
--            same-category hard negatives;
--   context ≤ +0.05 in total: the searcher's city (+0.02) and category
--            (+0.02) when given as a preference, listed in the last 30 days
--            (+0.01). There is no labelled data to fit these yet, so they are
--            bounded tie-breakers: they reorder near-equal visual matches
--            (|Δvisual| < 0.05) but can never lift a weak match over a strong
--            one. Filters (type/category/city) are hard filters.
create or replace function public.search_visual(
  p_model text, p_embedding real[], p_phash text, p_client_hash text,
  p_type text default null, p_category text default null, p_city text default null,
  p_prefer_category text default null, p_prefer_city text default null,
  p_limit int default 30)
returns table (item_id uuid, score real, visual real, cosine real, hamming int, tier text)
language plpgsql volatile security definer set search_path = public as $$
declare
  m public.visual_models%rowtype;
  v_hits int;
begin
  select * into m from public.visual_models where id = p_model and active;
  if not found or not public.visual_vector_ok(p_model, p_embedding) then
    raise exception 'bad_vector' using errcode = '22023';
  end if;
  if p_phash is not null and p_phash !~ '^[0-9a-f]{16}$' then
    raise exception 'bad_phash' using errcode = '22023';
  end if;
  if p_client_hash is null or p_client_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad_client' using errcode = '22023';
  end if;

  delete from public.visual_search_hits where at < now() - interval '1 day';
  select count(*) into v_hits from public.visual_search_hits
   where client_hash = p_client_hash and at > now() - interval '10 minutes';
  if v_hits >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.visual_search_hits (client_hash) values (p_client_hash);

  perform set_config('hnsw.ef_search', '200', true);
  perform set_config('hnsw.iterative_scan', 'relaxed_order', true);

  return query execute format($q$
    with q as (
      select $1::vector(%1$s) as v,
             case when $2 is null then null else ('x' || $2)::bit(64) end as h
    ),
    ann as (
      -- the model id and the query vector are inlined/parameters (not a
      -- join column) so the per-model partial HNSW index can serve this
      select e.item_id, 1 - (e.embedding::vector(%1$s) <=> $1::vector(%1$s)) as cos, e.phash
        from public.image_embeddings e
       where e.model_id = %7$L
       order by e.embedding::vector(%1$s) <=> $1::vector(%1$s)
       limit 200
    ),
    dup as (
      select e.item_id, 1 - (e.embedding::vector(%1$s) <=> q.v) as cos, e.phash
        from public.image_embeddings e, q
       where e.model_id = %7$L and q.h is not null and e.phash is not null
         and bit_count(e.phash # q.h) <= 8
    ),
    per_item as (
      select c.item_id, max(c.cos) as cos,
             min(case when q.h is null or c.phash is null then 64 else bit_count(c.phash # q.h) end)::int as ham
        from (select * from ann union all select * from dup) c, q
       group by c.item_id
    ),
    scored as (
      select p.item_id, p.cos, p.ham,
             (1 / (1 + exp(-(%2$s * p.cos + %3$s * greatest(0, 1 - p.ham / 32.0) + %4$s))))::real as visual,
             i.category, i.city, i.type::text as type, i.created_at
        from per_item p
        join public.items i on i.id = p.item_id
       where i.moderation_status = 'approved'
         and (i.is_resolved is null or i.is_resolved = false)
         and (i.status is null or i.status <> 'deleted')
         and i.deleted_at is null
         and ($4 is null or i.type::text = $4)
         and ($5 is null or i.category = $5)
         and ($6 is null or i.city = $6)
         and (p.ham <= 8 or p.cos >= %5$s)
    )
    select s.item_id,
           (s.visual
            + case when $7 is not null and s.category = $7 then 0.02 else 0 end
            + case when $8 is not null and s.city = $8 then 0.02 else 0 end
            + case when s.created_at > now() - interval '30 days' then 0.01 else 0 end)::real as score,
           s.visual,
           s.cos::real,
           s.ham,
           case when s.ham <= 8 then 'same_photo'
                when s.cos >= %6$s then 'very_similar'
                else 'similar' end
      from scored s
     order by 2 desc, s.cos desc, s.item_id
     limit least(greatest(coalesce($9, 30), 1), 30)
  $q$, m.dim, m.w_cos, m.w_phash, m.w_bias, m.t_similar, m.t_very_similar, m.id)
  using p_embedding, p_phash, p_model, p_type, p_category, p_city, p_prefer_category, p_prefer_city, p_limit;
end;
$$;
revoke all on function public.search_visual(text, real[], text, text, text, text, text, text, text, int) from public, anon, authenticated;

-- ── The model in use (lib/visual-model.ts, Web/tools/visual-bench/RESULTS.md)
-- DINOv2 ViT-S/14, 4-bit weights, 280 px, area resampling. Thresholds = cosine
-- at 1 % / 5 % false positives among 20 907 same-category hard-negative pairs;
-- weights = logistic fit on 1 089 positives vs those negatives.
insert into public.visual_models
  (id, name, model_sha256, preprocess_version, dim, t_similar, t_very_similar, w_cos, w_phash, w_bias, active)
values
  ('dinov2-s14-q4.r280-area-v1', 'DINOv2 ViT-S/14 (onnx-community q4)',
   '0f4a7f7d8524f2959407d0f35b09281111bc90c6ed105509290e36da1c669314',
   'squash280-area-imagenet-v1', 384, 0.6438, 0.7546, 9.978, 1.943, -6.513, true)
on conflict (id) do nothing;

-- One partial HNSW index per model (vectors of different models never mix).
create index if not exists image_embeddings_hnsw_dinov2_s14_q4_r280_v1
  on public.image_embeddings using hnsw ((embedding::vector(384)) vector_cosine_ops)
  where model_id = 'dinov2-s14-q4.r280-area-v1';
