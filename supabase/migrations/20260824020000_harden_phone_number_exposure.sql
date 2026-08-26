-- Ҳимояи рақами телефон аз scraping-и оммавӣ.
--
-- САБАБ. Ҳангоми санҷиши он ки чаро somon.tj рақами телефонро дар
-- parsing намедиҳад, маълум шуд: он рақамро қасдан паси воридшавии
-- ҳисоб (login) пинҳон мекунад (ниг. scripts/somon-import/README.md,
-- сатри "Рақами телефон қасдан гирифта намешавад"). Санҷиши JUYO нишон
-- дод, ки мо ду роҳи ХЕЛЕ осонтар барои ҷамъоварии оммавии рақамҳо
-- дорем — ҳарду бе ягон login, бе rate limit, бо танҳо калиди ошкорои
-- `NEXT_PUBLIC_SUPABASE_ANON_KEY`:
--
--   1. `get_qr_contact(p_id)` — `security definer`, ба `anon` дода
--      шудааст. `user_id` (Clerk id) барои ҲАР эълон тавассути
--      `search_items` (RPC-и ошкоро) дастрас аст — пас касе метавонад
--      ҳазорон user_id-ро ҷамъ кунад ва баъд барои ҳар кадом ин RPC-ро
--      мустақим (бе гузаштан аз саҳифаи Next.js) даъват кунад.
--   2. Ҷадвали `items` — RLS (`items_select_visible`) танҳо САТРҲОро
--      маҳдуд мекунад, на СТУНҲОро. Яъне `select phone_number,user_id
--      from items` тавассути PostgREST мустақим ҳамаи рақамҳои ҳамаи
--      эълонҳои тасдиқшударо дар ЯК дархост медиҳад — ҳатто аз
--      `search_items`-и худи барнома (ки phone_number намедиҳад)
--      бадтар.
--
-- ҲАЛ. Ҳарду масир маҳдуд карда мешавад, БЕ тағйир додани рафтори
-- намоёни корбар (finder ҳанӯз рақамро фавран мебинад, соҳиб ҳанӯз
-- login лозим надорад) — танҳо роҳи "дархости оммавӣ" баста мешавад:
--
--   • `get_qr_contact`/`increment_qr_scan_count`/`get_id_by_qr_code`
--     акнун танҳо аз ҷониби сервери худи Next.js (service role, ниг.
--     `lib/supabase-admin.ts`) даъват мешаванд — на аз браузер/скрипт
--     бо калиди ошкоро.
--   • `phone_number`-и `items` акнун бо REVOKE аз anon/authenticated
--     пӯшида аст; хониши он танҳо тавассути RPC-и нави
--     `get_item_phone(p_item_id)` мумкин аст — як эълон дар як
--     дархост, айнан ҳамон шарти намоёнии RLS-и кӯҳна (тасдиқшуда ё
--     соҳиби худ).
--
-- ДИҚҚАТ: ин миграция табиатан revoke мекунад — пеш аз татбиқ дар
-- production боварӣ ҳосил кунед, ки ҳеҷ query-и дигар (масалан
-- export/reporting-и дастӣ) ба `items.phone_number` мустақим такя
-- намекунад.

-- ── 1. QR-и профил: танҳо сервери худамон, на анони ошкоро ──────────
revoke execute on function public.get_qr_contact(text) from anon, authenticated;
revoke execute on function public.increment_qr_scan_count(text) from anon, authenticated;
revoke execute on function public.get_id_by_qr_code(text) from anon, authenticated;

-- ── 2. items.phone_number: бастани хониши стунӣ, кушодани RPC-и як-эълона ──
revoke select (phone_number) on public.items from anon, authenticated;

create or replace function public.get_item_phone(p_item_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select phone_number
  from public.items
  where id = p_item_id
    and (status is null or status <> 'deleted')
    and (moderation_status = 'approved' or get_auth_id() = user_id);
$$;

grant execute on function public.get_item_phone(uuid) to anon, authenticated;
