-- ============================================================================
-- 1) Вақте ки эълони нав тасдиқ (moderation_status -> approved) мешавад,
--    ба ҳамаи корбароне, ки худашон дар ҳамон категория эълон доранд
--    (ба ғайр аз муаллиф), push мефиристад — supabase/functions/notify-category-post.
--    WHEN-и триггер танҳо як бор ҳангоми ГУЗАШТАН ба approved фаъол мешавад
--    (на ҳар UPDATE-и дигар), новобаста аз он ки ин гузариш аз insert
--    (AI Brain дар клиент) ё аз admin approve рӯй медиҳад.
-- ============================================================================

create or replace function public.trigger_notify_category_post()
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
    url := 'https://aztuszloghjkynukjkaa.supabase.co/functions/v1/notify-category-post',
    headers := jsonb_build_object('Content-type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object('item_id', new.id)
  );
  return new;
end;
$$;

-- Postgres намегузорад, ки триггери INSERT дар WHEN ба OLD ишора кунад,
-- бинобар ин INSERT ва UPDATE-ро ду триггери ҷудогона мекунем.
drop trigger if exists on_item_inserted_approved_notify_category on public.items;
create trigger on_item_inserted_approved_notify_category
  after insert on public.items
  for each row
  when (new.moderation_status = 'approved')
  execute function public.trigger_notify_category_post();

drop trigger if exists on_item_updated_approved_notify_category on public.items;
create trigger on_item_updated_approved_notify_category
  after update on public.items
  for each row
  when (new.moderation_status = 'approved' and old.moderation_status is distinct from 'approved')
  execute function public.trigger_notify_category_post();

-- ============================================================================
-- 2) Ҳар бор, ки QR-и фаъоли корбаре scan мешавад, ба худи соҳиб push
--    мефиристад — supabase/functions/notify-qr-scan. increment_qr_scan_count()
--    аллакай аз /qr/[id] (Server Component) даъват мешавад; акнун илова бар
--    зиёд кардани шумора, шумораи навро низ мегирад ва дар паём мефиристад.
-- ============================================================================

create or replace function public.increment_qr_scan_count(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_active boolean;
  v_count int;
begin
  update public.profiles
  set qr_scan_count = qr_scan_count + 1
  where id = p_id and is_qr_active = true
  returning is_qr_active, qr_scan_count into v_active, v_count;

  if v_active then
    select decrypted_secret into v_key
    from vault.decrypted_secrets
    where name = 'service_role_key_for_triggers';

    perform net.http_post(
      url := 'https://aztuszloghjkynukjkaa.supabase.co/functions/v1/notify-qr-scan',
      headers := jsonb_build_object('Content-type', 'application/json', 'Authorization', 'Bearer ' || v_key),
      body := jsonb_build_object('user_id', p_id, 'scan_count', v_count)
    );
  end if;
end;
$$;

grant execute on function public.increment_qr_scan_count(text) to anon, authenticated;
