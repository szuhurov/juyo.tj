-- ============================================================================
-- No copy of deleted accounts or listings is kept (owner decision,
-- 2026-10-01). The privacy policy said "erased within 30 days", but
-- deleted_accounts_archive / deleted_items_archive kept full snapshots (name,
-- phone, listings) forever and nothing ever purged them.
--
-- From this release the app code no longer writes to these tables
-- (lib/services/account-deletion.ts, lib/services/item-deletion.ts, both
-- admin permanent-delete routes, the clerk-sync Edge Function). This
-- migration removes what was archived so far and unlinks listing-history
-- rows from people who no longer have an account.
--
-- DESTRUCTIVE and NOT reversible: the archived snapshots are gone for good
-- (that is the point). Take a backup first if a copy is needed for a legal
-- request that is already open.
-- ============================================================================

delete from public.deleted_items_archive;
delete from public.deleted_accounts_archive;

update public.item_lifecycle_events e
set actor_id = null
where e.actor_id is not null
  and e.actor_type in ('user', 'staff')
  and not exists (select 1 from public.profiles p where p.id = e.actor_id);
