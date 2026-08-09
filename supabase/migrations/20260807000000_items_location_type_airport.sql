-- Илова кардани "airport" (Фурудгоҳ) ба рӯйхати location_type — quick-action
-- нави дигар дар паҳлӯи taxi/hotel_restaurant/public_place. Constraint-и
-- куҳна дроп ва бо арзиши нав аз нав сохта мешавад.
alter table public.items
  drop constraint if exists items_location_type_check;

alter table public.items
  add constraint items_location_type_check
  check (location_type in ('taxi', 'hotel_restaurant', 'public_place', 'airport') or location_type is null);
