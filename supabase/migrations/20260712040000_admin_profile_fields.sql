-- ============================================================================
-- Admin CRM: profiles.email / profiles.last_login_at
-- ============================================================================
-- supabase/functions/clerk-sync/index.ts already writes to profiles.email
-- (user.created/user.updated) and profiles.last_login_at (session.created),
-- but neither column exists live yet, so those webhook writes have been
-- silently failing. The admin Users page needs both fields. Idempotent.
-- ============================================================================

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists last_login_at timestamptz;

create index if not exists idx_profiles_email      on public.profiles (email);
create index if not exists idx_profiles_created_at on public.profiles (created_at);
create index if not exists idx_profiles_status     on public.profiles (status);
