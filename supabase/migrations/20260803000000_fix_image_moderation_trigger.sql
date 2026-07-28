-- Ислоҳи ду bug дар trigger_image_moderation():
-- 1. body := '{}'::jsonb мефиристод — Edge Function payload.record.id-ро
--    мехонд, вале record ҳеҷ гоҳ вуҷуд надошт → 500 "Cannot read properties
--    of undefined (reading 'id')" барои ҳар як элони нав/навшуда.
-- 2. app_settings.ai_moderation_enabled тамоман тафтиш намешуд — ҳатто
--    вақте admin AI-ро аз panel хомӯш мекард, trigger боз ҳам AI-ро занг
--    мезад.
create or replace function public.trigger_image_moderation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_key text;
  v_ai_enabled boolean;
begin
  select ai_moderation_enabled into v_ai_enabled
  from public.app_settings
  where id = true;

  if v_ai_enabled is false then
    return new;
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'service_role_key_for_triggers';

  perform net.http_post(
    url := 'https://aztuszloghjkynukjkaa.supabase.co/functions/v1/image-moderation',
    headers := jsonb_build_object('Content-type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object('record', row_to_json(new))
  );
  return new;
end;
$$;
