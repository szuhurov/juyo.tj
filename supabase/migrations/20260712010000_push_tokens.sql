-- ============================================================================
-- Push notification tokens (native Expo push tokens + web push subscriptions)
-- ============================================================================
create table if not exists public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  platform   text not null check (platform in ('expo', 'web')),
  token      text not null, -- Expo push token string, or JSON.stringify(PushSubscription) for web
  created_at timestamptz default now(),
  unique (user_id, token)
);
create index if not exists idx_push_tokens_user on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_owner_manage on public.push_tokens;
create policy push_tokens_owner_manage on public.push_tokens
  for all using (user_id = get_auth_id())
  with check (user_id = get_auth_id());
