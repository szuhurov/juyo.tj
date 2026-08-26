-- Супоридани ашёи ёфтшуда ба ҷои наздик (handoff) — саволи нави
-- wizard-и items/add, танҳо барои type='found': "Худат нигоҳ медорӣ ё
-- ба ҷои наздик месупорӣ?". Ихтиёрӣ аст, барои ҳамин ҳама nullable, бе
-- default.
alter table public.items
  add column handoff_type text
    check (handoff_type in ('self', 'nearby') or handoff_type is null),
  add column handoff_phone text,
  add column handoff_photo_url text;

-- handoff_phone бояд ҳамон ҳимояи phone_number-ро гирад (ниг.
-- 20260824020000_harden_phone_number_exposure.sql) — на бо
-- column-и оммавӣ хонда шавад, балки танҳо тавассути RPC-и якэълона.
revoke select (handoff_phone) on public.items from anon, authenticated;

create or replace function public.get_item_handoff_phone(p_item_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select handoff_phone
  from public.items
  where id = p_item_id
    and (status is null or status <> 'deleted')
    and (moderation_status = 'approved' or get_auth_id() = user_id);
$$;

grant execute on function public.get_item_handoff_phone(uuid) to anon, authenticated;
