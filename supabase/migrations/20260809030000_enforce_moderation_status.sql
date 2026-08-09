-- ХАТОГИИ АМНИЯТӢ: RLS-и items_owner_manage танҳо соҳибиятро (get_auth_id() =
-- user_id) тафтиш мекунад — ҳеҷ маҳдудият барои он, ки соҳиб худаш моҳиятан
-- моҳияти moderation_status-ро чӣ гузорад. Trigger-и мавҷуда
-- (trigger_image_moderation, AFTER INSERT/UPDATE) танҳо вақте санҷиши воқеиро
-- оғоз мекунад, ки NEW.moderation_status = 'pending' бошад — агар корбар
-- мустақим 'approved' фиристад, trigger ҳеҷ коре намекунад ва ашё бе ҳеҷ
-- санҷиши AI/admin нашр мешавад (ҳатто моддаи қаблан 'rejected'-ро низ
-- метавон ба 'approved' баргардонд).
--
-- Ин BEFORE trigger ин холигиро мепӯшонад: барои ҳар навиштаи ғайри-
-- imtiyozӣ (яъне на аз тариқи service_role — edge function-ҳо, supabaseAdmin,
-- admin API, скриптҳои import — ва на аз тариқи пайвасти мустақими DB, ки ин
-- худаш дар кор кардан бо MCP/CLI бошад):
--   * INSERT — moderation_status ҳамеша 'pending' мегардад, новобаста аз он
--     чи клиент фиристодааст. trigger_image_moderation (аллакай мавҷуда)
--     санҷиши воқеиро оғоз мекунад ва (агар moderation_exempt бошад) худаш
--     ба 'approved' мегузаронад.
--   * UPDATE — агар moderation_status тағйир ёфта бошад: ба 'pending'
--     бармегардонд иҷозат аст (санҷиши навро оғоз мекунад), вале мустақим ба
--     'approved'/'rejected' не — чунин кӯшиш ба қиммати қаблӣ баргардонда
--     мешавад (бесадо, бе хатогӣ, то UI-и мавҷуда нашиканад).

create or replace function public.enforce_moderation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_privileged boolean;
begin
  v_privileged := (
    current_setting('request.jwt.claims', true) is null
    or (current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role'
  );

  if v_privileged then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    new.moderation_status := 'pending';
    new.moderation_result := null;
    return new;
  end if;

  if new.moderation_status is distinct from old.moderation_status then
    if new.moderation_status = 'pending' then
      new.moderation_result := null;
    else
      new.moderation_status := old.moderation_status;
      new.moderation_result := old.moderation_result;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_moderation_status_trigger on public.items;
create trigger enforce_moderation_status_trigger
  before insert or update on public.items
  for each row execute function public.enforce_moderation_status();
