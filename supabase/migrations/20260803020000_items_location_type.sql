-- Ҷои гумшудан/ёфтшудани ашё (location_type) — саволи нави wizard-и
-- items/add: "Дар куҷо гум/ёфт кардед?". Ихтиёрӣ аст (корбар метавонад
-- нагузорад), барои ҳамин nullable, бе default.
alter table public.items
  add column location_type text
  check (location_type in ('taxi', 'hotel_restaurant', 'public_place') or location_type is null);

create index if not exists idx_items_location_type
  on public.items (location_type)
  where location_type is not null;
