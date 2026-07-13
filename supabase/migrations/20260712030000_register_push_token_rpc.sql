-- Native (Expo) calls Supabase with the anon key only, no Clerk JWT attached
-- (pre-existing pattern in the native app — same trust model as its items
-- insert). Route push-token registration through a narrow SECURITY DEFINER
-- RPC instead of a raw table insert so it doesn't depend on get_auth_id().
create or replace function public.register_push_token(p_user_id text, p_platform text, p_token text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_platform not in ('expo', 'web') then
    raise exception 'invalid platform';
  end if;

  insert into public.push_tokens (user_id, platform, token)
  values (p_user_id, p_platform, p_token)
  on conflict (user_id, token) do nothing;
end;
$$;
grant execute on function public.register_push_token(text, text, text) to anon, authenticated;
