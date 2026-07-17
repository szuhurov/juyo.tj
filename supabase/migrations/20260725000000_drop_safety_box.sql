-- Safety Box feature (private item archive) пурра аз система нест шуд —
-- ҳам frontend (сафҳаи /profile?tab=safety, /profile/safety/[id]) ва ҳам
-- backend (API routes, item-service methods) аллакай нест шудаанд. Ин
-- migration ҷадвали дар БД боқимондаро низ пок мекунад (index, trigger, ва
-- RLS policy-и он бо CASCADE худкор нест мешаванд).
drop table if exists public.safety_box cascade;
