-- ============================================================================
-- Permanent account deletion. Two distinct flows now write here:
--   1. A user deleting their own account (user.delete() -> Clerk -> user.deleted
--      webhook) — always a full, immediate hard-delete, no trash stage.
--   2. An admin permanently deleting an already-trashed (status='deleted')
--      profile from the admin panel — also goes through Clerk deleteUser(),
--      which fires the same user.deleted webhook.
-- Both cascade-hard-delete the profile and everything that references it
-- (items, item_images, saved_items, safety_box, item_verification_attempts),
-- but a snapshot of the profile is kept here first so admins can still see
-- who existed even after the row itself is gone. This is NOT a general
-- activity log (that was removed on purpose) — it only ever gets a row when
-- an account is permanently destroyed.
-- ============================================================================

create table if not exists public.deleted_accounts_archive (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  profile_snapshot  jsonb not null,
  items_count       int not null default 0,
  deleted_at        timestamptz default now()
);
create index if not exists idx_deleted_accounts_archive_user on public.deleted_accounts_archive(user_id);
create index if not exists idx_deleted_accounts_archive_deleted_at on public.deleted_accounts_archive(deleted_at desc);

-- Service-role only (Edge Function), same pattern as the old audit_log: RLS
-- on with zero policies = default deny for anon/authenticated.
alter table public.deleted_accounts_archive enable row level security;
