-- ============================================================================
-- QR-код: admin мехоҳад бинад, ки кадом корбарон QR-и худро фаъол
-- кардаанд (nasb kardaand) ва чанд бор фаъол кардаанд + чанд бор scan
-- шудааст. profiles.is_qr_active аллакай ҳаст (фаъол/ғайрифаъол ҳозира),
-- ин ду шумора таърихи "чанд бор"-ро илова мекунад.
-- ============================================================================

alter table public.profiles add column if not exists qr_activation_count int not null default 0;
alter table public.profiles add column if not exists qr_scan_count int not null default 0;

-- Ҳар бор, ки корбар худи QR-ро фаъол мекунад (ProfileService.updateProfile,
-- is_qr_active: false -> true), ин RPC мезанад. Definer + маҳдудияти соҳиб
-- дар дохили функсия, то race-и read-then-write набошад.
create or replace function public.increment_qr_activation_count(p_user_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if get_auth_id() <> p_user_id then
    raise exception 'Not authorized';
  end if;
  update public.profiles set qr_activation_count = qr_activation_count + 1 where id = p_user_id;
end;
$$;
grant execute on function public.increment_qr_activation_count(text) to authenticated;

-- Ҳар бор, ки касе саҳифаи ҷамъиятии /qr/[id]-ро (QR-и фаъолро) мебинад
-- (яъне воқеан QR-и чопшуда scan шудааст). Анонимӣ дастрас аст — на
-- соҳиб, балки ёбандаи ашё ин саҳифаро мекушояд.
create or replace function public.increment_qr_scan_count(p_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set qr_scan_count = qr_scan_count + 1 where id = p_id and is_qr_active = true;
$$;
grant execute on function public.increment_qr_scan_count(text) to anon, authenticated;
