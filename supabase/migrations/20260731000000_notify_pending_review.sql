-- Вақте ки эълони нав бе AI moderation (admin аз dashboard хомӯш карда
-- буд, ниг. app_settings.ai_moderation_enabled) бо moderation_status
-- 'pending' сохта мешавад, ба ҳисоби admin (zuhurovsamariddinn1@gmail.com)
-- push-и фарқкунанда мефиристад — supabase/functions/notify-pending-review.
create or replace function public.trigger_notify_pending_review()
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
    url := 'https://aztuszloghjkynukjkaa.supabase.co/functions/v1/notify-pending-review',
    headers := jsonb_build_object('Content-type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object('item_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists on_item_inserted_pending_notify_admin on public.items;
create trigger on_item_inserted_pending_notify_admin
  after insert on public.items
  for each row
  when (new.moderation_status = 'pending')
  execute function public.trigger_notify_pending_review();
