-- Repairs supabase_migrations.schema_migrations so the live history matches
-- the files in supabase/migrations. METADATA ONLY — no schema object is
-- created, altered or dropped. Not a migration (kept outside migrations/ so
-- the CLI never runs it); run manually once, after review.
--
-- Why: migrations were applied through several paths (MCP apply_migration,
-- dashboard SQL, app/supabase), which recorded their own timestamp
-- versions. State verified read-only on 2026-09-27:
--   * 12 live rows are duplicates of a migration that is ALSO recorded
--     under its file version (same change recorded twice).
--   * 6 live rows are the only record of a file whose version differs.
--   * 3 files are not recorded at all, though their effect is already live
--     (index / column / superseded function) — verified with pg_indexes,
--     information_schema and pg_proc.
--
-- NOT handled here (needs a decision, see the reconciliation notes):
--   * 20260818010000_drop_secondary_phone_type.sql was never applied —
--     profiles.secondary_phone_type still exists live. Applying it drops
--     data; left alone.
--   * 20260930000006 and 20260930000007 are each used by TWO files locally
--     (items_city_other + vip_tier_visible_to_clients, vip_plans_pricing +
--     get_vip_items). A fresh `supabase db reset` cannot replay that.
--     items_city_other / vip_plans_pricing / vvip_exclusive /
--     subscription_replace_pending / vip_three_options stay recorded under
--     their original live timestamps until the files are renumbered.
--
-- Rollback: the whole thing runs in one transaction; the backup table
-- below keeps the previous rows for manual restore.

begin;

create table if not exists supabase_migrations.schema_migrations_backup_20260927 as
  select * from supabase_migrations.schema_migrations;

-- 1. Duplicate records: the same file is already recorded under its own version.
delete from supabase_migrations.schema_migrations
where version in (
  '20260728120010', -- = 20260803000000_fix_image_moderation_trigger
  '20260729080133', -- = 20260803010000_moderation_exempt_and_item_delete
  '20260802114511', -- = 20260803020000_items_location_type
  '20260802114523', -- = 20260803030000_search_items_location_type
  '20260807092417', -- = 20260807000000_items_location_type_airport
  '20260809114217', -- = 20260809000000_notifications_text_match
  '20260809115454', -- = 20260809010000_notifications_text_match_title_only
  '20260809120358', -- = 20260809020000_match_item_images_moderation_filter
  '20260809130512', -- = 20260809030000_enforce_moderation_status
  '20260809133947', -- = 20260809040000_reenforce_moderation_on_content_edit
  '20260811103246', -- = 20260811000000_match_item_images_best_per_item
  '20260813141938'  -- = 20260813000000_post_expiry_lifecycle
);

-- 2. Only record of a file whose version differs: move it to the file version.
update supabase_migrations.schema_migrations
set version = '20260921000000'
where version = '20260909165136'; -- item_images_thumbnail_url

-- 3. Files whose effect is already live but were never recorded.
insert into supabase_migrations.schema_migrations (version, name)
values
  ('20260914000000', 'search_items_location_none'),   -- superseded by search_v2
  ('20260921000001', 'saved_items_item_id_index')     -- idx_saved_items_item_id exists
on conflict (version) do nothing;

-- Sanity check: expect 0 rows for the versions touched above.
select version, name from supabase_migrations.schema_migrations
where version in ('20260909165136', '20260728120010', '20260813141938');

commit;
