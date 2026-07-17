-- Нишони "тасдиқшуда" (verified checkmark) — admin метавонад ба ҳисоби
-- шахс/ширкати воқеӣ бидиҳад, дар паҳлӯи аватар/ном барои ҳама намоён
-- мешавад (item detail, QR-и профил).
alter table public.profiles add column if not exists is_verified boolean not null default false;

-- public_profiles VIEW-ро навсозӣ мекунем, то is_verified низ дар бар гирад.
-- Сутуни нав бояд дар ОХИР бошад (Postgres CREATE OR REPLACE VIEW иҷозат
-- намедиҳад, ки тартиби сутунҳои мавҷуда тағйир ёбад).
create or replace view public.public_profiles as
  select id, first_name, last_name, avatar_url, created_at, is_verified
  from public.profiles;

-- get_qr_contact(): return type тағйир меёбад (сутуни нав) — CREATE OR
-- REPLACE-и оддӣ иҷозат намедиҳад, аввал DROP лозим аст.
drop function if exists public.get_qr_contact(text);
create or replace function public.get_qr_contact(p_id text)
returns table(
  first_name text, last_name text, avatar_url text,
  phone text, secondary_phone text, is_qr_active boolean, is_verified boolean
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
    is_verified
  from public.profiles
  where id = p_id;
$$;
grant execute on function public.get_qr_contact(text) to anon, authenticated;
