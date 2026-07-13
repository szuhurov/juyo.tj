-- ============================================================================
-- Soft-delete for items, mirroring the existing profiles.status/deleted_at
-- pattern. Deleting a post (by its owner or an admin) must no longer erase
-- the row/photos — related data (saved_items, safety_box, verification
-- attempts, admin history) needs the item to keep existing so it stays
-- correct even after the item — or its owner — is "deleted".
-- ============================================================================

alter table public.items add column if not exists status text default 'active' check (status in ('active', 'deleted'));
alter table public.items add column if not exists deleted_at timestamptz;

create index if not exists idx_items_active_status on public.items(status);
