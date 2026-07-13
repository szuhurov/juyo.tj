-- ============================================================================
-- Baseline schema snapshot — juyo.tj production database
-- ============================================================================
-- This is the first tracked migration for this project. The schema existed
-- before migrations were introduced (built ad-hoc via the SQL editor), so
-- this file captures the CURRENT, already-live state (post security audit —
-- see 20260711200001 onward for the fixes applied on top of the original
-- ad-hoc schema, kept as separate files for history).
--
-- Applying this file against a fresh database reproduces production.
-- Applying it against production itself is a no-op (everything already
-- exists) — it is safe to run with `create ... if not exists` throughout.
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "vector";
create extension if not exists "pg_net";
create extension if not exists "pg_cron";
create extension if not exists "supabase_vault";

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type public.item_type as enum ('lost', 'found');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.moderation_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ── Tables ──────────────────────────────────────────────────────────────────

-- profiles: one row per Clerk user. Private — only the owner may read/write
-- (see RLS below). Public-facing subsets are exposed via the public_profiles
-- view and the get_qr_contact() function, never via direct table access.
create table if not exists public.profiles (
  id                    text primary key,             -- Clerk user id (sub claim)
  first_name            text,
  last_name             text,
  avatar_url            text,
  phone                 text,
  secondary_phone       text,
  secondary_phone_type  text,
  accepted_terms        boolean default false,
  accepted_at           timestamptz,
  terms_version         text,
  is_qr_active          boolean default true,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  constraint check_terms_consent check (
    accepted_terms = false
    or (accepted_terms = true and accepted_at is not null and terms_version is not null)
  )
);

-- items: lost/found listings.
create table if not exists public.items (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text references public.profiles(id) on delete cascade,
  title              text not null,
  description        text,
  category           text not null,
  type               public.item_type not null default 'lost',
  date               date not null default current_date,
  reward             text,
  phone_number       text,
  is_resolved        boolean default false,
  is_guest           boolean default false,
  views              integer default 0,
  moderation_status  public.moderation_status default 'pending',
  moderation_result  text,
  expires_at         timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
  -- NOTE: no `embedding` column here — visual-search embeddings live on
  -- item_images (one embedding per photo), not on items.
);

-- item_images: photos per item, each with its own visual-search embedding.
create table if not exists public.item_images (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid references public.items(id) on delete cascade,
  image_url   text not null,
  embedding   vector(1536),
  created_at  timestamptz default now()
);

-- saved_items: user's bookmarked items (composite PK — one save per user/item).
create table if not exists public.saved_items (
  user_id     text not null references public.profiles(id) on delete cascade,
  item_id     uuid not null references public.items(id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (user_id, item_id)
);

-- safety_box: items a user archived into their private "safety box".
create table if not exists public.safety_box (
  id                uuid primary key default gen_random_uuid(),
  user_id           text references public.profiles(id) on delete cascade,
  item_name         text not null,
  description       text,
  category          text,
  type              text,
  reward            text,
  phone_number      text,
  images            text[],
  views             integer default 0,
  date              date,
  text_moderated    boolean default false,
  images_moderated  boolean default false,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- audit_log: append-only log, written by service-role/Edge Functions only.
-- Intentionally has no RLS policies (RLS is on, no policy = default deny for
-- anon/authenticated; only service-role, which bypasses RLS, can write/read).
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  actor_id     text,
  action       text not null,
  entity_type  text not null,
  entity_id    text,
  metadata     jsonb,
  created_at   timestamptz default now()
);

-- ── Views ───────────────────────────────────────────────────────────────────

-- public_profiles: the ONLY safe way to read another user's basic identity.
-- Runs with view-owner privileges (not security_invoker), so it stays
-- readable regardless of the caller — this is intentional and is why it
-- deliberately excludes phone/secondary_phone.
create or replace view public.public_profiles as
  select id, first_name, last_name, avatar_url, created_at
  from public.profiles;

-- ── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_items_user_id             on public.items (user_id);
create index if not exists idx_items_category             on public.items (category);
create index if not exists idx_items_type                 on public.items (type);
create index if not exists idx_items_is_resolved           on public.items (is_resolved);
create index if not exists idx_items_created_at            on public.items (created_at desc);
create index if not exists idx_items_moderation            on public.items (moderation_status);
create index if not exists idx_items_moderation_created     on public.items (moderation_status, created_at desc);
create index if not exists idx_item_images_item_id         on public.item_images (item_id);
create index if not exists idx_saved_items_user_id         on public.saved_items (user_id);
create index if not exists idx_safety_box_user_id          on public.safety_box (user_id);
create index if not exists idx_profiles_terms_version      on public.profiles (terms_version);
create index if not exists idx_audit_log_entity            on public.audit_log (entity_type, entity_id);
create index if not exists idx_audit_log_created           on public.audit_log (created_at desc);
create index if not exists idx_audit_log_actor             on public.audit_log (actor_id);
-- NOTE: idx_items_type and a few others show 0 scans in pg_stat_user_indexes,
-- but the tables currently hold single-digit/low-double-digit row counts —
-- Postgres correctly prefers seq scans at this size regardless of indexes.
-- Do not drop these based on current stats; re-evaluate once rows are in the
-- thousands and pg_stat_user_indexes reflects real traffic.

-- ── Functions ───────────────────────────────────────────────────────────────

-- get_auth_id(): resolves the current request's Clerk user id from the JWT.
-- Every RLS policy below calls this instead of repeating the COALESCE
-- expression inline — single source of truth for "who is making this
-- request", matching however Clerk's JWT template evolves.
create or replace function public.get_auth_id()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::json ->> 'user_id', ''),
    nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')
  )::text;
$$;

create or replace function public.increment_item_views(item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.items set views = views + 1 where id = item_id;
end;
$$;

create or replace function public.match_item_images(
  query_embedding vector,
  match_threshold double precision,
  match_count integer,
  p_type text default 'all'
)
returns table(id uuid, item_id uuid, image_url text, similarity double precision, title text, description text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    img.id, img.item_id, img.image_url,
    1 - (img.embedding <=> query_embedding) as similarity,
    i.title, i.description
  from public.item_images img
  join public.items i on img.item_id = i.id
  where (p_type = 'all' or i.type::text = p_type)
    and i.is_resolved = false
    and img.embedding is not null
    and 1 - (img.embedding <=> query_embedding) > match_threshold
  order by img.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- get_qr_contact(): the ONLY sanctioned way to read a user's phone number
-- anonymously. Backs the public "/qr/[id]" contact page (someone scans a
-- found item's QR code and needs to call the owner). Deliberately narrow:
-- one row by id, phone only surfaced while is_qr_active = true. Never grant
-- broader anon SELECT on profiles directly — see 20260711200001.
create or replace function public.get_qr_contact(p_id text)
returns table(
  first_name text, last_name text, avatar_url text,
  phone text, secondary_phone text, is_qr_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    first_name, last_name, avatar_url,
    case when is_qr_active then phone else null end,
    case when is_qr_active then secondary_phone else null end,
    is_qr_active
  from public.profiles
  where id = p_id;
$$;
grant execute on function public.get_qr_contact(text) to anon, authenticated;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- trigger_image_moderation(): fires the image-moderation Edge Function on
-- item insert/update. Reads the service-role key from Vault at call time
-- instead of embedding it in the trigger definition (see 20260711200001 for
-- why that mattered).
create or replace function public.trigger_image_moderation()
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
    url := 'https://aztuszloghjkynukjkaa.supabase.co/functions/v1/image-moderation',
    headers := jsonb_build_object('Content-type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb
  );
  return new;
end;
$$;

-- ── Triggers ────────────────────────────────────────────────────────────────
drop trigger if exists tr_items_updated_at on public.items;
create trigger tr_items_updated_at
  before update on public.items
  for each row execute function public.update_updated_at_column();

drop trigger if exists tr_profiles_updated_at on public.profiles;
create trigger tr_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

drop trigger if exists tr_safety_box_updated_at on public.safety_box;
create trigger tr_safety_box_updated_at
  before update on public.safety_box
  for each row execute function public.update_updated_at_column();

drop trigger if exists on_item_created_moderate on public.items;
create trigger on_item_created_moderate
  after insert or update on public.items
  for each row execute function public.trigger_image_moderation();

-- ── Row Level Security ────────────────────────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.items        enable row level security;
alter table public.item_images  enable row level security;
alter table public.saved_items  enable row level security;
alter table public.safety_box   enable row level security;
alter table public.audit_log    enable row level security; -- no policies: service-role only, by design

drop policy if exists profiles_owner_manage on public.profiles;
create policy profiles_owner_manage on public.profiles
  for all using (get_auth_id() = id) with check (get_auth_id() = id);

drop policy if exists items_owner_manage on public.items;
create policy items_owner_manage on public.items
  for all using (get_auth_id() = user_id) with check (get_auth_id() = user_id);

drop policy if exists items_select_visible on public.items;
create policy items_select_visible on public.items
  for select using (moderation_status = 'approved' or get_auth_id() = user_id);

drop policy if exists images_owner_manage on public.item_images;
create policy images_owner_manage on public.item_images
  for all using (
    exists (select 1 from public.items where items.id = item_images.item_id and items.user_id = get_auth_id())
  ) with check (
    exists (select 1 from public.items where items.id = item_images.item_id and items.user_id = get_auth_id())
  );

drop policy if exists images_select_visible on public.item_images;
create policy images_select_visible on public.item_images
  for select using (
    exists (
      select 1 from public.items
      where items.id = item_images.item_id
        and (items.moderation_status = 'approved' or items.user_id = get_auth_id())
    )
  );

drop policy if exists saved_items_owner_manage on public.saved_items;
create policy saved_items_owner_manage on public.saved_items
  for all using (get_auth_id() = user_id) with check (get_auth_id() = user_id);

drop policy if exists safety_box_owner_manage on public.safety_box;
create policy safety_box_owner_manage on public.safety_box
  for all using (get_auth_id() = user_id) with check (get_auth_id() = user_id);

-- ── Storage ─────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('items', 'items', true)
  on conflict (id) do nothing;

drop policy if exists "Authenticated Users Upload" on storage.objects;
create policy "Authenticated Users Upload" on storage.objects
  for insert to public
  with check (bucket_id = 'items' and auth.role() = 'authenticated');

drop policy if exists "Public Access to Images" on storage.objects;
create policy "Public Access to Images" on storage.objects
  for select to public
  using (bucket_id = 'items');

drop policy if exists "Public read access" on storage.objects;
create policy "Public read access" on storage.objects
  for select to public
  using (bucket_id = 'items');

drop policy if exists "Allow authenticated users to delete images" on storage.objects;
create policy "Allow authenticated users to delete images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'items'
    and (owner::text = nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '') or owner is null)
  );

drop policy if exists "Owners can delete their images" on storage.objects;
create policy "Owners can delete their images" on storage.objects
  for delete to public
  using (bucket_id = 'items' and auth.uid()::text = (storage.foldername(name))[1]);
