-- 1. Майдони нав: агар true бошад, элонҳои корбар бе AI moderation худкор
--    "тасдиқшуда" мешаванд (танҳо барои posting-и оддии тавассути wizard,
--    на воридоти Telegram/Somon, ки аллакай ҳамеша 'approved' мебошанд).
alter table public.profiles add column if not exists moderation_exempt boolean not null default false;

-- 2. Нав кардани trigger_image_moderation(): ҳам guard-и recursion (танҳо
--    вақте moderation_status='pending' воқеан коркард шавад — ин инчунин
--    масъалаи пешинаро ҳал мекунад, ки ҳар UPDATE-и элони аллакай тасдиқшуда
--    боз AI-ро занг мезад), ҳам тафтиши moderation_exempt пеш аз OpenAI.
create or replace function public.trigger_image_moderation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_key text;
  v_ai_enabled boolean;
  v_exempt boolean;
begin
  if NEW.moderation_status is distinct from 'pending' then
    return new;
  end if;

  select moderation_exempt into v_exempt
  from public.profiles
  where id = NEW.user_id;

  if v_exempt is true then
    update public.items
    set moderation_status = 'approved', moderation_result = 'Auto-approved (trusted poster)'
    where id = NEW.id;
    return new;
  end if;

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

-- 3. Фаъол кардани bypass барои Ali Mirzoev (allimirzoev2000@icloud.com).
update public.profiles set moderation_exempt = true where id = 'user_3H0PTIOzFRgmfVuBGBrKYR6RcFO';
