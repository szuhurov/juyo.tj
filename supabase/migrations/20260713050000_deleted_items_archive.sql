-- ============================================================================
-- Пурра нест кардани эълон — монанди deleted_accounts_archive барои корбарон:
-- admin метавонад эълони аллакай дар trash буда (status='deleted')-ро пурра
-- нест кунад. Пеш аз ин як snapshot захира мешавад, то маълумот пурра нест
-- нашавад — танҳо аз рӯйхатҳо ва база нест мешавад.
-- ============================================================================

create table if not exists public.deleted_items_archive (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null,
  item_snapshot  jsonb not null,
  deleted_at     timestamptz default now()
);
create index if not exists idx_deleted_items_archive_item on public.deleted_items_archive(item_id);
create index if not exists idx_deleted_items_archive_deleted_at on public.deleted_items_archive(deleted_at desc);

-- Service-role only (admin API route), ҳамон тавре ки deleted_accounts_archive.
alter table public.deleted_items_archive enable row level security;
