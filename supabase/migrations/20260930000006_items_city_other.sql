-- Adds "other" as a valid items.city value (for listings outside the 18 official
-- cities). Only the CHECK constraint changes: search_items already filters with
-- `i.city = p_city`, so p_city = 'other' works without touching the function.
-- organization_branches.city keeps its own (unchanged) 18-city constraint — branches
-- are never "other".
--
-- Rollback (fails if any row already has city = 'other' — move those rows first):
--   alter table public.items drop constraint if exists items_city_check;
--   alter table public.items add constraint items_city_check check (city in (
--     'dushanbe', 'khujand', 'bokhtar', 'kulob', 'tursunzoda', 'istaravshan',
--     'vahdat', 'hisor', 'panjakent', 'khorugh', 'isfara', 'konibodom',
--     'norak', 'roghun', 'guliston', 'buston', 'istiqlol', 'levakant'
--   ));

begin;

alter table public.items drop constraint if exists items_city_check;
alter table public.items add constraint items_city_check check (city in (
  'dushanbe', 'khujand', 'bokhtar', 'kulob', 'tursunzoda', 'istaravshan',
  'vahdat', 'hisor', 'panjakent', 'khorugh', 'isfara', 'konibodom',
  'norak', 'roghun', 'guliston', 'buston', 'istiqlol', 'levakant', 'other'
));

commit;
