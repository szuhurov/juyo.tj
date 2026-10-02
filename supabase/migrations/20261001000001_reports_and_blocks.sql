-- ============================================================================
-- Report + block (Apple App Review 1.2: apps with user-generated content must
-- let people report offensive content and block abusive users).
--
-- content_reports: a signed-in user reports a listing and/or its poster.
--   * insert: only as yourself (reporter_id = get_auth_id()), never your own
--     listing/account; one open report per reporter per target.
--   * select: only your own reports. Admins read all through the service role
--     (Web /api/admin/reports), same as every other admin table.
--   * no client update/delete — status changes are admin-only.
--   * 3 distinct reporters on one approved listing send it back to 'pending'
--     (hidden from the public by the existing items RLS) until an admin looks.
--
-- user_blocks: a signed-in user hides another user's listings for themselves.
--   * all access only on your own rows. Clients filter the feed with it; the
--     blocked user is not told.
--
-- Both reference profiles(id) on delete cascade, so account deletion removes
-- them. content_reports.item_id is set null when the listing is deleted, so a
-- report about a removed listing still shows for the admin (reason/details only).
--
-- Rollback:
--   drop trigger if exists content_reports_auto_hide on public.content_reports;
--   drop function if exists public.content_reports_auto_hide();
--   drop table if exists public.content_reports;
--   drop table if exists public.user_blocks;
-- ============================================================================

create table if not exists public.content_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      text not null references public.profiles(id) on delete cascade,
  item_id          uuid references public.items(id) on delete set null,
  reported_user_id text references public.profiles(id) on delete cascade,
  reason           text not null check (reason in (
                     'spam', 'scam', 'offensive', 'personal_info', 'fake', 'other'
                   )),
  details          text check (char_length(details) <= 1000),
  status           text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  admin_note       text,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  check (item_id is not null or reported_user_id is not null),
  check (reported_user_id is distinct from reporter_id)
);

create index if not exists idx_content_reports_status_created on public.content_reports(status, created_at desc);
create index if not exists idx_content_reports_item on public.content_reports(item_id);
create unique index if not exists uq_content_reports_open_item
  on public.content_reports(reporter_id, item_id) where status = 'open' and item_id is not null;
create unique index if not exists uq_content_reports_open_user
  on public.content_reports(reporter_id, reported_user_id) where status = 'open' and item_id is null;

alter table public.content_reports enable row level security;

drop policy if exists content_reports_insert_own on public.content_reports;
create policy content_reports_insert_own on public.content_reports
  for insert
  with check (
    reporter_id = get_auth_id()
    and status = 'open'
    and admin_note is null
    and resolved_at is null
    and (
      item_id is null
      or not exists (select 1 from public.items i where i.id = item_id and i.user_id = get_auth_id())
    )
  );

drop policy if exists content_reports_select_own on public.content_reports;
create policy content_reports_select_own on public.content_reports
  for select using (reporter_id = get_auth_id());

-- The poster is always derived from the listing, never trusted from the client.
create or replace function public.content_reports_fill_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.item_id is not null then
    select user_id into new.reported_user_id from public.items where id = new.item_id;
  end if;
  return new;
end;
$$;

drop trigger if exists content_reports_fill_user on public.content_reports;
create trigger content_reports_fill_user
  before insert on public.content_reports
  for each row execute function public.content_reports_fill_user();

create or replace function public.content_reports_auto_hide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporters int;
begin
  if new.item_id is null then
    return new;
  end if;

  select count(distinct reporter_id) into v_reporters
  from public.content_reports
  where item_id = new.item_id and status = 'open';

  if v_reporters >= 3 then
    update public.items
    set moderation_status = 'pending',
        moderation_result = 'Hidden after user reports — awaiting admin review'
    where id = new.item_id and moderation_status = 'approved';
  end if;
  return new;
end;
$$;

drop trigger if exists content_reports_auto_hide on public.content_reports;
create trigger content_reports_auto_hide
  after insert on public.content_reports
  for each row execute function public.content_reports_auto_hide();

create table if not exists public.user_blocks (
  blocker_id  text not null references public.profiles(id) on delete cascade,
  blocked_id  text not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_owner_manage on public.user_blocks;
create policy user_blocks_owner_manage on public.user_blocks
  for all using (blocker_id = get_auth_id()) with check (blocker_id = get_auth_id());

grant select, insert on public.content_reports to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

notify pgrst, 'reload schema';
