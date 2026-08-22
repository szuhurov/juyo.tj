-- ============================================================================
-- Огоҳиномаи скани QR ПУРРА бардошта мешавад.
--
-- Қарори корбар: скан ба худи худ ҳодисаи муҳим нест. Он на эълон дорад, на
-- ҷои гузаштан, ва аз он ҳеҷ амале барнамеояд — рӯйхати огоҳиномаҳоро танҳо
-- пур мекард. Сканкунанда номаълум аст ва номаълум мемонад (саҳифаи /qr/[id]
-- ҷамъиятӣ ва бе вуруд аст), пас илова кардани маълумоти ӯ низ ғайриимкон буд.
--
-- Ҳисобак `profiles.qr_scan_count` НИГОҲ ДОШТА МЕШАВАД — панели админ онро
-- нишон медиҳад (`components/admin/users/user-qr-stats.tsx`).
--
-- Ин миграция функсияро аз нав муайян мекунад, БЕ даъвати push. Функсияи
-- Edge `notify-qr-scan` низ аз реша нест карда шуд — агар он дар Supabase
-- ҳанӯз ҷойгир бошад, онро дастӣ нест кунед.
-- ============================================================================

create or replace function public.increment_qr_scan_count(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set qr_scan_count = qr_scan_count + 1
  where id = p_id and is_qr_active = true;
end;
$$;

grant execute on function public.increment_qr_scan_count(text) to anon, authenticated;
