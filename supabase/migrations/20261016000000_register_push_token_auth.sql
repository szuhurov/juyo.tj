-- SECURITY GAP FOUND 2026-10-16: register_push_token() took the user id from
-- the caller and anyone — even without signing in — could call it. A person
-- could save their own phone's token under someone else's account (the
-- admin's included) and receive that account's notifications.
--
-- Now a token is accepted only for the signed-in caller's own account
-- (get_auth_id(), the same check the push_tokens RLS policy uses), and a
-- token moving to another account is removed from the previous one, so a
-- phone that changes hands stops getting the old account's notifications.
--
-- The website already saves its tokens through RLS with the user's session.
-- The app sends its session from 1.0.1 (build 38). Earlier app builds called
-- this without a session and will be refused — on 2026-10-16 the only saved
-- tokens belonged to the admin, so no user loses notifications.
-- Rollback: restore the 20260712030000 version of the function and grant
-- execute to anon again.

create or replace function public.register_push_token(p_user_id text, p_platform text, p_token text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_platform not in ('expo', 'web') then
    raise exception 'invalid platform';
  end if;
  if public.get_auth_id() is null or public.get_auth_id() is distinct from p_user_id then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- A token that moves to another account leaves the previous one.
  update public.push_tokens set user_id = p_user_id
   where token = p_token and user_id <> p_user_id
     and not exists (select 1 from public.push_tokens t where t.user_id = p_user_id and t.token = p_token);

  insert into public.push_tokens (user_id, platform, token)
  values (p_user_id, p_platform, p_token)
  on conflict (user_id, token) do nothing;
end;
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
