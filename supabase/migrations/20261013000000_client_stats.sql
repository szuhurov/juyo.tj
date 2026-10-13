-- Admin statistics: who uses the mobile app, and where each listing was posted from.
--
-- JUYO has no analytics SDK (by design), so the admin panel could not tell
-- how many people use the app or which listings came from it. This adds the
-- two facts the panel needs, kept inside our own database:
--
--   profiles.app_*   the signed-in user's phone platform and app version,
--                    reported by the app itself (register_app_client)
--   items.source     where the listing was posted from
--
-- Additive only: every column is nullable, old app builds and the current
-- website keep working unchanged (they simply leave the columns empty).
-- Rollback: drop the trigger, the function and the five columns.

alter table public.profiles
  add column if not exists app_platform text,
  add column if not exists app_version text,
  add column if not exists app_first_seen_at timestamptz,
  add column if not exists app_last_seen_at timestamptz;

do $$ begin
  alter table public.profiles
    add constraint profiles_app_platform_check check (app_platform in ('ios', 'android'));
exception when duplicate_object then null; end $$;

alter table public.items
  add column if not exists source text;

do $$ begin
  alter table public.items
    add constraint items_source_check check (source in ('web', 'app', 'instagram', 'telegram', 'admin'));
exception when duplicate_object then null; end $$;

-- profiles is private (owner-only RLS; public_profiles lists its columns
-- explicitly), so the new columns are not exposed to other users.

-- The app calls this once per launch for the signed-in user.
create or replace function public.register_app_client(p_platform text, p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_user text := case when v_claims is null or v_claims = '' then null else v_claims::json ->> 'sub' end;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid platform';
  end if;
  update public.profiles
     set app_platform = p_platform,
         app_version = left(coalesce(p_version, ''), 20),
         app_first_seen_at = coalesce(app_first_seen_at, now()),
         app_last_seen_at = now()
   where id = v_user;
end;
$$;

revoke all on function public.register_app_client(text, text) from public, anon;
grant execute on function public.register_app_client(text, text) to authenticated;

-- A client may only say 'web' or 'app'; the other sources are set by the
-- server (service role). The source of an existing listing never changes
-- through a client.
create or replace function public.items_guard_source()
returns trigger
language plpgsql
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_service boolean := v_claims is null or v_claims = '' or (v_claims::json ->> 'role') = 'service_role';
begin
  if v_service then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.source is not null and new.source not in ('web', 'app') then
      new.source := null;
    end if;
  else
    new.source := old.source;
  end if;
  return new;
end;
$$;

drop trigger if exists items_guard_source on public.items;
create trigger items_guard_source
  before insert or update on public.items
  for each row execute function public.items_guard_source();
