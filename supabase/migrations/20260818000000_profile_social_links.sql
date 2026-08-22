-- Шабакаҳои иҷтимоии профил — ИХТИЁРӢ.
--
-- Корбар ҳангоми боргирии QR метавонад ягон, ду ё ҳар се-и онҳоро пур
-- кунад. Баъд аз скан кардани QR ин нишонаҳо дар гирди аватари соҳиб
-- нишон дода мешаванд, то ёбанда роҳи дуюми тамос дошта бошад.
--
-- Формати нигоҳдорӣ — ҳамон чизе ки корбар менависад, БЕ префикс:
--   telegram   → номи корбар бе `@` ЁКИ рақам → https://t.me/<value>
--   instagram  → номи корбар бе `@`           → https://instagram.com/<value>
--   whatsapp   → рақам бо коди кишвар         → https://wa.me/<value>
--   facebook   → номи профил                  → https://facebook.com/<value>
--
-- Ҳамаашон nullable — ҳеҷ кадомашон ҳатмӣ нест ва набудани онҳо ба
-- боргирии QR монеъ намешавад.

alter table public.profiles
  add column if not exists telegram  text,
  add column if not exists instagram text,
  add column if not exists whatsapp  text,
  add column if not exists facebook  text;

-- Маҳдудияти дарозӣ — ҳимоя аз матни бемаънии дароз. Номи корбари
-- Telegram/Instagram то 32/30 ҳарф аст, рақами WhatsApp то 20.
alter table public.profiles
  add constraint profiles_telegram_len  check (telegram  is null or char_length(telegram)  <= 64),
  add constraint profiles_instagram_len check (instagram is null or char_length(instagram) <= 64),
  add constraint profiles_whatsapp_len  check (whatsapp  is null or char_length(whatsapp)  <= 24),
  add constraint profiles_facebook_len  check (facebook  is null or char_length(facebook)  <= 64);

-- get_qr_contact(): ягона роҳи иҷозатдодашуда барои хондани тамоси корбар
-- аз ҷониби меҳмон. Шабакаҳо низ маҳз аз ҳамин ҷо мебароянд — ҷадвали
-- `profiles` барои `anon` кушода НЕСТ ва набояд кушода шавад.
--
-- Мисли `phone` онҳо танҳо ҳангоми `is_qr_active` бармегарданд: агар
-- соҳиб QR-ро хомӯш кунад, ҳеҷ роҳи тамос намоён намемонад.
--
-- Навъи бозгашт тағйир меёбад, пас `create or replace`-и оддӣ кор
-- намекунад — аввал `drop` лозим аст.
drop function if exists public.get_qr_contact(text);
create or replace function public.get_qr_contact(p_id text)
returns table(
  first_name text, last_name text, avatar_url text,
  phone text, secondary_phone text, is_qr_active boolean, is_verified boolean,
  telegram text, instagram text, whatsapp text, facebook text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    first_name, last_name, avatar_url,
    case when is_qr_active then phone else null end,
    case when is_qr_active then secondary_phone else null end,
    is_qr_active,
    is_verified,
    case when is_qr_active then telegram  else null end,
    case when is_qr_active then instagram else null end,
    case when is_qr_active then whatsapp  else null end,
    case when is_qr_active then facebook  else null end
  from public.profiles
  where id = p_id;
$$;

grant execute on function public.get_qr_contact(text) to anon, authenticated;
