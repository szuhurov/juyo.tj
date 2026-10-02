-- ============================================================================
-- Storage + deletion hardening (legal/privacy audit 2026-10-01, P0).
--
-- 1. Photo deletion: the old policy let ANY signed-in user delete any object
--    whose `owner` was null — and with Clerk JWTs `owner` (uuid) is null for
--    every upload. Now a user may delete only objects they uploaded
--    (`owner_id`, the text JWT `sub` that Storage records on upload).
--    Older uploads without owner_id can no longer be deleted from a client;
--    server code (service role) still deletes them on account/listing deletion.
-- 2. Listing the bucket: the two SELECT policies let anyone enumerate every
--    file (pending/rejected listings, ID photos, orphans). The bucket stays
--    public, so photos still load by URL — public URLs do not use these
--    policies. Uploads (INSERT, no upsert) don't need SELECT either.
-- 3. Account deletion leftovers: rows of users who no longer exist in tables
--    that have no FK to profiles (the app code now deletes them on deletion;
--    this removes what was left behind before).
--
-- Rollback: re-create the policies from 20260711200000 (storage section).
-- The purged orphan rows cannot come back (that is the point).
-- ============================================================================

drop policy if exists "Public Access to Images" on storage.objects;
drop policy if exists "Public read access" on storage.objects;

drop policy if exists "Allow authenticated users to delete images" on storage.objects;
drop policy if exists "Owners can delete their images" on storage.objects;
create policy "Uploader can delete own images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'items' and owner_id is not null and owner_id = get_auth_id());

delete from public.push_notification_log t where not exists (select 1 from public.profiles p where p.id = t.user_id);
delete from public.notification_reads t where not exists (select 1 from public.profiles p where p.id = t.user_id);
delete from public.dismissed_notifications t where not exists (select 1 from public.profiles p where p.id = t.user_id);
delete from public.deleted_notifications_archive t where not exists (select 1 from public.profiles p where p.id = t.user_id);
delete from public.payment_events t where not exists (select 1 from public.profiles p where p.id = t.user_id);
delete from public.subscriptions t where not exists (select 1 from public.profiles p where p.id = t.user_id);
