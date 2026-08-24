-- ============================================================================
-- Талаби корбар: имконияти "Шикоят кардан дар бораи эълон" ва "Block кардани
-- корбар" пурра бардошта мешавад — ҳам аз UI (веб ва барнома), ҳам аз
-- панели admin (таби "Шикоятҳо"), ҳам аз база. Ин бекор кардани мустақими
-- миграцияи 20260801000000_item_reports_and_user_blocks.sql аст.
--
-- ДИҚҚАТ: `items_select_visible` дар он миграция ду филтрро дар ЯК policy
-- омехта карда буд (AI-модератсия + блоки корбар). Ин ҷо он ба шакли
-- пешинааш (танҳо AI-модератсия, аз 20260711200000_baseline_schema.sql)
-- бармегардад — DROP TABLE-и оддӣ кофӣ нест.
-- ============================================================================

drop policy if exists items_select_visible on public.items;
create policy items_select_visible on public.items
  for select using (moderation_status = 'approved' or get_auth_id() = user_id);

drop function if exists public.get_my_blocked_users();
drop function if exists public.unblock_user(text);
drop function if exists public.block_user(text);
drop function if exists public.report_item(uuid, text, text);

drop table if exists public.user_blocks;
drop table if exists public.item_reports;
