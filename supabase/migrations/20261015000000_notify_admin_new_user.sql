-- Owner request 2026-10-15: the admin gets a notification (Chrome and the
-- app) for every new account, as he already should for every listing that
-- waits for review. Same mechanism as trigger_notify_pending_review
-- (20260731000000): pg_net calls the notify-pending-review Edge Function with
-- the service-role key from Vault; the function sends no name or email.
--
-- Profiles the admin creates himself (none today, but "instagram_" ids were
-- used for Instagram requests) are not announced.
-- Rollback: drop trigger on_profile_inserted_notify_admin and the function.

create or replace function public.trigger_notify_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_key text;
begin
  if new.id like 'instagram\_%' then
    return new;
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'service_role_key_for_triggers';

  perform net.http_post(
    url := 'https://aztuszloghjkynukjkaa.supabase.co/functions/v1/notify-pending-review',
    headers := jsonb_build_object('Content-type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object('new_user_id', new.id)
  );
  return new;
exception when others then
  -- A notification must never stop an account from being created.
  return new;
end;
$$;
revoke all on function public.trigger_notify_new_user() from public, anon, authenticated;

drop trigger if exists on_profile_inserted_notify_admin on public.profiles;
create trigger on_profile_inserted_notify_admin
  after insert on public.profiles
  for each row execute function public.trigger_notify_new_user();
