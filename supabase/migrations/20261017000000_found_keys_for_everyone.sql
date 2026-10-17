-- Owner decision 2026-10-17: everyone may post a "Found" listing for KEYS;
-- every other category stays for verified accounts only (20261013010000).
-- Same rule as lib/found-policy.ts in both clients.
--
-- Also checked now: moving an existing "Found" listing into another category
-- (the old rule only looked at the type).
-- Rollback: re-run 20261013010000_found_only_verified.sql.

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
  if new.category = 'Keys' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.type = 'found' and old.category is not distinct from new.category then
    return new;
  end if;
  if not exists (select 1 from public.profiles where id = new.user_id and is_verified is true) then
    raise exception 'found_not_allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.items_found_only_verified() from public, anon, authenticated;

create or replace trigger items_found_only_verified_trigger
  before insert or update of type, category on public.items
  for each row execute function public.items_found_only_verified();
