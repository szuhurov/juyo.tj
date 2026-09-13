-- Илова кардани "gym" (Толори варзишӣ) ба рӯйхати location_type —
-- quick-action-и нав дар паҳлӯи taxi/hotel_restaurant/public_place/
-- airport (талаби корбар — "fintech_center" қасдан илова нашуд, зеро
-- дар native чунин quick-action вуҷуд надорад, ниг. app/(tabs)/index.tsx
-- дар juyoapp). Ниг. намунаи 20260807000000_items_location_type_airport.sql.
alter table public.items
  drop constraint if exists items_location_type_check;

alter table public.items
  add constraint items_location_type_check
  check (location_type in ('taxi', 'hotel_restaurant', 'public_place', 'airport', 'gym') or location_type is null);
