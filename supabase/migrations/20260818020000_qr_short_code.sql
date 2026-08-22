-- Рамзи кӯтоҳи QR — то нуқтаҳои стикер калонтар шаванд.
--
-- МУШКИЛ. Андозаи нуқта як тақсими содда аст:
--
--     андозаи нуқта = андозаи стикер ÷ шумораи модулҳо
--
-- Суроғаи ҳозира `https://juyo.tj/qr/user_3Dqp9UtdA…` 51 ҳарф аст, ки
-- 32-тои он ID-и Clerk мебошад. Бо сатҳи ҳимояи H ин QR-и 41×41 медиҳад
-- ва нуқтаҳо хеле майда мебароянд.
--
-- ҲАЛ. Суроға кӯтоҳ мешавад: `https://juyo.tj/q/ABC123` — 24 ҳарф. Ҳамон
-- сатҳи ҳимоя H акнун 29×29 медиҳад, яъне нуқтаҳо 41% калонтар — БЕ кам
-- кардани ҳимоя.
--
--     51 ҳарф, H  →  41 × 41
--     24 ҳарф, H  →  29 × 29   (+41% ба андозаи нуқта)
--
-- Диққат: бо 24 ҳарф мо маҳз дар ҳадди ғунҷоиши H истодаем (24 аз 24).
-- Барои ҳамин рамз 6 ҳарф аст ва бояд 6 монад — ҳарфи ҳафтум QR-ро ба
-- 33×33 мебарорад ва тамоми фоидаро мебарад.
--
-- Стикерҳои аллакай чопшуда КОР МЕКУНАНД: масири кӯҳнаи `/qr/<id>` нест
-- намешавад, танҳо масири нави `/q/<code>` илова мегардад.

-- ── Тавлиди рамз ────────────────────────────────────────────────────
--
-- Алифбо қасдан ҳарфҳои ба ҳам монандро НАДОРАД (0/O, 1/I/L): рамз
-- метавонад дар чек ё паём дастӣ хонда шавад.
create or replace function public.gen_qr_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate text;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    -- 31^6 ≈ 887 млн вариант; такрор амалан ғайриимкон, вале санҷида мешавад
    exit when not exists (select 1 from public.profiles where qr_code = candidate);
  end loop;
  return candidate;
end;
$$;

alter table public.profiles
  add column if not exists qr_code text;

-- Ҳамаи профилҳои мавҷуда рамз мегиранд.
update public.profiles set qr_code = public.gen_qr_code() where qr_code is null;

alter table public.profiles
  alter column qr_code set default public.gen_qr_code(),
  alter column qr_code set not null;

create unique index if not exists profiles_qr_code_key on public.profiles (qr_code);

-- ── Хондани рамз аз ҷониби меҳмон ───────────────────────────────────
--
-- Ҷадвали `profiles` барои `anon` кушода НЕСТ. Ин функсия ягона роҳи
-- иҷозатдодашуда барои табдили рамз ба ID аст ва ҒАЙР аз ID ҳеҷ чизи
-- дигар барнамегардонад — тамоси воқеӣ ҳамоно аз `get_qr_contact`
-- гирифта мешавад, ки шартҳои `is_qr_active`-и худро дорад.
create or replace function public.get_id_by_qr_code(p_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where qr_code = upper(p_code) limit 1;
$$;

grant execute on function public.get_id_by_qr_code(text) to anon, authenticated;

-- `get_qr_contact` низ рамзро бармегардонад, то барнома ва веб QR-ро бо
-- суроғаи кӯтоҳ созанд.
drop function if exists public.get_qr_contact(text);
create or replace function public.get_qr_contact(p_id text)
returns table(
  first_name text, last_name text, avatar_url text,
  phone text, secondary_phone text, is_qr_active boolean, is_verified boolean,
  telegram text, instagram text, whatsapp text, facebook text,
  qr_code text
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
    case when is_qr_active then facebook  else null end,
    qr_code
  from public.profiles
  where id = p_id;
$$;

grant execute on function public.get_qr_contact(text) to anon, authenticated;
