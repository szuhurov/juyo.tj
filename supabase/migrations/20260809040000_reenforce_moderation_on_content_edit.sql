-- Холигии дигар: enforce_moderation_status (20260809030000) танҳо вақте
-- дахолат мекард, ки корбар мустақим moderation_status-ро тағйир диҳад.
-- Вале edit-page ҳамеша moderation_status='approved'-ро дубора мефиристад
-- (бе тағйир аз OLD='approved'), ҳатто вақте ки title/description-ро воқеан
-- ба чизи манъшуда иваз мекунад — пас "is distinct from old" ҳаргиз рост
-- намешуд ва санҷиши сервер (trigger_image_moderation) ҳаргиз оғоз намешуд.
--
-- Ҳоло: агар корбари ғайри-imtiyozӣ title/description/category-ро ВОҚЕАН
-- тағйир диҳад, moderation_status новобаста аз он чи клиент фиристодааст
-- маҷбуран 'pending' мешавад — trigger_image_moderation (аллакай мавҷуда)
-- сипас худаш AI-ро (агар фаъол бошад) ё интизории admin-ро (агар AI
-- хомӯш бошад) дуруст интихоб мекунад. Агар ҳеҷ чиз тағйир наёфта бошад,
-- moderation_status бетағйир мемонад — санҷиши нав лозим нест.

create or replace function public.enforce_moderation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_privileged boolean;
  v_content_changed boolean;
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
    return new;
  end if;

  -- Мазмуни ҳассос (title/description/category) воқеан тағйир ёфт, вале
  -- moderation_status-ро тағйир надод (масалан ҳамоно 'approved' фиристод)
  -- — маҷбуран ба 'pending' мебарем, то санҷиши воқеӣ дубора гузарад.
  v_content_changed := (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.category is distinct from old.category
  );

  if v_content_changed and old.moderation_status <> 'pending' then
    new.moderation_status := 'pending';
    new.moderation_result := null;
  end if;

  return new;
end;
$$;
