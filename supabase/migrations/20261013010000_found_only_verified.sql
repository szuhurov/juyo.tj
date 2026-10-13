-- Owner decision 2026-10-13: a "Found" listing can be used to trick people
-- (someone claims to have found an item to get money or personal details),
-- so only accounts the owner has verified — companies and authorities,
-- profiles.is_verified — may post one. The website and the app no longer
-- show the option to anyone else; this enforces the same rule for every
-- client (old app builds, modified clients).
--
-- The admin (service role) is not restricted, and existing "Found" listings
-- stay as they are: only creating one, or turning a listing into one, is
-- checked.
-- Rollback: drop trigger items_found_only_verified_trigger and the function.

create or replace function public.items_found_only_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_service boolean := v_claims is null or v_claims = '' or (v_claims::json ->> 'role') = 'service_role';
begin
  if v_service or new.type is distinct from 'found' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.type = 'found' then
    return new;
  end if;
  if not exists (select 1 from public.profiles where id = new.user_id and is_verified is true) then
    raise exception 'found_not_allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.items_found_only_verified() from public, anon, authenticated;

drop trigger if exists items_found_only_verified_trigger on public.items;
create trigger items_found_only_verified_trigger
  before insert or update of type on public.items
  for each row execute function public.items_found_only_verified();
