-- ============================================================================
-- Push notification when a claimant submits a verification attempt.
-- Same pattern as trigger_image_moderation(): reads the service-role key from
-- Vault at call time, fires the notify-verification Edge Function which looks
-- up the item owner's push tokens (Expo + web) and sends the notification.
-- ============================================================================
create or replace function public.notify_verification_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if new.status <> 'pending_review' then
    return new;
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'service_role_key_for_triggers';

  perform net.http_post(
    url := 'https://aztuszloghjkynukjkaa.supabase.co/functions/v1/notify-verification',
    headers := jsonb_build_object('Content-type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object('item_id', new.item_id)
  );
  return new;
end;
$$;

drop trigger if exists tr_verification_attempt_notify on public.item_verification_attempts;
create trigger tr_verification_attempt_notify
  after insert on public.item_verification_attempts
  for each row execute function public.notify_verification_attempt();
