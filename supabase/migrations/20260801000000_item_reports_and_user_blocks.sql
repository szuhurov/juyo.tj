-- ============================================================================
-- User-generated-content compliance (Google Play / App Store UGC policy):
-- корбарон бояд имконияти шикоят кардан дар бораи эълон ва block кардани
-- корбари дигарро дошта бошанд. Ин ду ҷадвал + RPC-ҳо ҳамин ду имкониятро
-- медиҳанд; block автоматӣ эълонҳои корбари block-шударо аз рӯйхат (RLS)
-- пинҳон мекунад — ҳеҷ тағйироти клиентӣ дар query-ҳои рӯйхат лозим нест.
-- ============================================================================

create table if not exists public.item_reports (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items(id) on delete cascade,
  reporter_id text not null,
  reason      text not null check (reason in ('spam', 'inappropriate', 'fake', 'offensive', 'other')),
  details     text,
  status      text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at  timestamptz not null default now(),
  unique (item_id, reporter_id)
);
create index if not exists idx_item_reports_status_pending on public.item_reports(created_at desc) where status = 'pending';
alter table public.item_reports enable row level security;
-- Бе policy = ҳама дархост deny — навиштан танҳо тавассути report_item (security definer),
-- хондан танҳо тавассути admin API (service role, мисли дигар archive-ҳо).

create table if not exists public.user_blocks (
  blocker_id text not null,
  blocked_id text not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists idx_user_blocks_blocked on public.user_blocks(blocked_id);
alter table public.user_blocks enable row level security;

create policy user_blocks_owner_select on public.user_blocks
  for select using (get_auth_id() = blocker_id);

-- RPC: шикоят дар бораи эълон. Такрори якхела (ҳамон корбар, ҳамон эълон)
-- бояд навсозӣ шавад (сабаб/тафсилот тағйир дода бошад), на хатогӣ диҳад.
create or replace function public.report_item(p_item_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_reason not in ('spam', 'inappropriate', 'fake', 'offensive', 'other') then
    raise exception 'Invalid reason';
  end if;

  insert into public.item_reports (item_id, reporter_id, reason, details)
  values (p_item_id, v_user_id, p_reason, p_details)
  on conflict (item_id, reporter_id)
  do update set reason = excluded.reason, details = excluded.details, status = 'pending', created_at = now();
end;
$$;
grant execute on function public.report_item(uuid, text, text) to authenticated;

create or replace function public.block_user(p_user_id text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if v_user_id = p_user_id then
    raise exception 'Cannot block yourself';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_user_id, p_user_id)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;
grant execute on function public.block_user(text) to authenticated;

create or replace function public.unblock_user(p_user_id text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.user_blocks where blocker_id = v_user_id and blocked_id = p_user_id;
end;
$$;
grant execute on function public.unblock_user(text) to authenticated;

create or replace function public.get_my_blocked_users()
returns table (
  user_id     text,
  first_name  text,
  last_name   text,
  avatar_url  text,
  blocked_at  timestamptz
)
language sql security definer set search_path = public stable
as $$
  select p.id, p.first_name, p.last_name, p.avatar_url, b.created_at
  from public.user_blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = get_auth_id()
  order by b.created_at desc;
$$;
grant execute on function public.get_my_blocked_users() to authenticated;

-- Эълонҳои корбари block-шударо худкор аз рӯйхат пинҳон мекунад — на танҳо
-- барои "лаззат", балки ин ягона ҷои дуруст барои ин мантиқ аст (RLS,
-- набояд ҳар query-и клиентӣ дар web ва native ин филтрро дубора нависад).
drop policy if exists items_select_visible on public.items;
create policy items_select_visible on public.items
  for select using (
    (moderation_status = 'approved'::moderation_status or get_auth_id() = user_id)
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = get_auth_id() and b.blocked_id = items.user_id
    )
  );
