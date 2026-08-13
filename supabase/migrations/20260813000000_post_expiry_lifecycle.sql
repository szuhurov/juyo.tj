-- Худкор нест кардани эълонҳо баъд аз мӯҳлат, бо огоҳии пешакӣ.
--
-- ВАЗЪИ ПЕШТАРА: сутуни `items.expires_at`, edge function
-- `cleanup-expired-posts` ва cron-и рӯзонаи 02:00 аллакай мавҷуд буданд ва
-- cron 62 бор бомуваффақият кор карда буд — вале ҳеҷ ҷои код `expires_at`-ро
-- намегузошт, пас ҳамаи 105 эълон `null` доштанд ва ҳар шаб 0 сатр ёфт
-- мешуд. Ин миграция маҳз ҳамон пораи намерасидаро мегузорад.
--
-- ҶАРАЁН (ҳама чиз ПЕШ аз мӯҳлат тамом мешавад):
--   expires_at − 72 соат  → огоҳинома ба соҳиб, `expiry_notified_at` сабт
--   «Ҳанӯз лозим»         → expires_at = now + мӯҳлат, огоҳинома бекор
--   «Нест кун»            → фавран нест
--   expires_at расид      → нест кардани воқеӣ (сатр + аксҳо аз Storage)
--
-- Агар корбар огоҳинома фаъол накарда бошад, ҳеҷ хабар намеравад ва эълон
-- дар худи `expires_at` бе огоҳӣ нест мешавад.

-- 1. Мӯҳлат дар танзимот — то admin онро бе deploy иваз карда тавонад.
--    Ҳамон намунаи `ai_moderation_enabled` (як сатр, id = true).
alter table public.app_settings
  add column if not exists post_lifetime_days integer not null default 180;

comment on column public.app_settings.post_lifetime_days is
  'Мӯҳлати зиндагии эълон бо рӯз. 72 соат пеш аз он ба соҳиб огоҳинома меравад.';

-- 2. Кай огоҳии пешакӣ фиристода шуд. Холӣ = ҳанӯз нарафтааст.
--    Ин ЛАҲЗАИ НЕСТКУНӢ НЕСТ — несткунӣ ҳамеша дар `expires_at` мешавад.
alter table public.items
  add column if not exists expiry_notified_at timestamptz;

comment on column public.items.expiry_notified_at is
  'Лаҳзаи фиристодани огоҳии «72 соат мондааст». Холӣ бошад, ҳанӯз нарафтааст.';

-- 3. Индексҳо барои ду пурсиши cron. Partial — сатрҳои мувофиқ хеле каманд
--    нисбат ба тамоми ҷадвал.
create index if not exists items_expiry_warn_idx
  on public.items (expires_at)
  where status = 'active' and expiry_notified_at is null;

create index if not exists items_expiry_due_idx
  on public.items (expires_at)
  where expires_at is not null;

-- 4. Ҳангоми сабти эълони нав `expires_at` худкор гузошта шавад.
--    Маҳз trigger, на `default` дар сутун: мӯҳлат аз `app_settings` меояд ва
--    default-и сутун қимати сахтро мемехкӯб мекард — тағйири танзимот дар
--    admin ба эълонҳои нав таъсир намекард.
--    Native app низ ҳамин ҷадвалро мустақим менависад, пас trigger ягона
--    ҷойест, ки ҳарду роҳро фаро мегирад.
create or replace function public.set_item_expires_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lifetime integer;
begin
  if new.expires_at is not null then
    return new;
  end if;

  select post_lifetime_days into lifetime from public.app_settings where id = true;
  new.expires_at := coalesce(new.created_at, now()) + make_interval(days => coalesce(lifetime, 180));
  return new;
end;
$$;

drop trigger if exists trigger_set_item_expires_at on public.items;
create trigger trigger_set_item_expires_at
  before insert on public.items
  for each row execute function public.set_item_expires_at();

-- 5. Таҳрири эълон мӯҳлатро аз нав оғоз мекунад — ин "хабар аз эълон" аст.
--    Танҳо ҳангоми тағйири МАЗМУН, на ҳар update (масалан `views`),
--    вагарна ҳар кушодани саҳифа мӯҳлатро дароз мекард.
create or replace function public.refresh_item_expiry_on_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lifetime integer;
begin
  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.category is distinct from old.category
     or new.phone_number is distinct from old.phone_number then
    select post_lifetime_days into lifetime from public.app_settings where id = true;
    new.expires_at := now() + make_interval(days => coalesce(lifetime, 180));
    new.expiry_notified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_refresh_item_expiry_on_edit on public.items;
create trigger trigger_refresh_item_expiry_on_edit
  before update on public.items
  for each row execute function public.refresh_item_expiry_on_edit();

-- 6. Эълонҳои мавҷуда. Санҷида шуд: пештарин эълон 31.07.2026 аст, яъне
--    ҳеҷ як аз 6 моҳ кӯҳнатар нест ва ҳеҷ чиз фавран нест намешавад.
update public.items
   set expires_at = created_at + make_interval(
         days => (select coalesce(post_lifetime_days, 180) from public.app_settings where id = true))
 where expires_at is null;
