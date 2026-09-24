-- ============================================================================
-- Phase 4 — Notifications: server-authoritative read/unread state.
--
-- Both computed-feed notification kinds (`category_post`, `expiry_confirm`)
-- currently have no persisted read state at all — the web and mobile clients
-- each track "seen"/"opened" purely in localStorage/AsyncStorage, so it
-- doesn't survive a reinstall, doesn't sync across devices, and is not
-- something an admin could ever audit. This adds a real table, following
-- the exact same shape/convention as `dismissed_notifications`
-- (20260721000000_dismiss_notifications.sql): RLS enabled with NO policies
-- (writes only through SECURITY DEFINER RPCs; reads are folded into the
-- existing notification RPCs / a small dedicated RPC, never a direct
-- client select of this table).
-- ============================================================================

create table if not exists public.notification_reads (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  kind       text not null check (kind in ('category_post', 'expiry_confirm')),
  ref_id     uuid not null,
  read_at    timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);
create index if not exists idx_notification_reads_lookup on public.notification_reads(user_id, kind, ref_id);

alter table public.notification_reads enable row level security;

-- RPC: mark ONE notification read (row tap / expand).
create or replace function public.mark_notification_read(p_kind text, p_ref_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_kind not in ('category_post', 'expiry_confirm') then
    raise exception 'Invalid kind';
  end if;

  insert into notification_reads (user_id, kind, ref_id)
  values (v_user_id, p_kind, p_ref_id)
  on conflict (user_id, kind, ref_id) do nothing;
end;
$$;

grant execute on function public.mark_notification_read(text, uuid) to authenticated;

-- RPC: mark SEVERAL notifications read at once ("mark all as read") — two
-- parallel arrays (kind[i] goes with ref_id[i]), since the client already
-- has the full, mixed-kind list in hand and this avoids a round trip per row.
create or replace function public.mark_notifications_read(p_kinds text[], p_ref_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if array_length(p_kinds, 1) is null then
    return;
  end if;
  if array_length(p_kinds, 1) <> array_length(p_ref_ids, 1) then
    raise exception 'p_kinds and p_ref_ids must be the same length';
  end if;
  if exists (select 1 from unnest(p_kinds) k where k not in ('category_post', 'expiry_confirm')) then
    raise exception 'Invalid kind';
  end if;

  insert into notification_reads (user_id, kind, ref_id)
  select v_user_id, k, r
  from unnest(p_kinds, p_ref_ids) as t(k, r)
  on conflict (user_id, kind, ref_id) do nothing;
end;
$$;

grant execute on function public.mark_notifications_read(text[], uuid[]) to authenticated;

-- RPC: the caller's own read markers — folded client-side into the existing
-- item lists to compute unread state, instead of a direct table select
-- (kept consistent with the "no direct client select of dismissed_notifications
-- either" convention). Bounded — a user's genuinely unbounded read history
-- isn't needed, only enough to cover what get_my_category_notifications /
-- the expiry query currently return.
create or replace function public.get_my_notification_reads(p_limit int default 500)
returns table (kind text, ref_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select kind, ref_id
  from public.notification_reads
  where user_id = get_auth_id()
  order by read_at desc
  limit p_limit;
$$;

grant execute on function public.get_my_notification_reads(int) to authenticated;

-- ============================================================================
-- Push notification limits — a per-user, per-kind rolling 24h send counter,
-- checked (and appended to) only from the notify-category-post Edge
-- Function, which already runs with the service-role key. Service-role
-- bypasses RLS, so — like `audit_log` — this table needs RLS enabled and
-- deliberately zero policies for any other caller; no RPC is exposed for it.
-- Only `category_post` (an algorithmic "you might be interested" notice) is
-- capped; there is currently no push path for `expiry_confirm` at all (it's
-- in-app only), so no security/deadline-bearing notice is ever throttled
-- by this table.
-- ============================================================================

create table if not exists public.push_notification_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  kind       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_notification_log_lookup on public.push_notification_log(user_id, kind, created_at desc);

alter table public.push_notification_log enable row level security;
