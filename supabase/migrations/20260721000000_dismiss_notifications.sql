-- ============================================================================
-- Имконияти корбар барои нест кардани огоҳиномаи худ аз рӯйхаташ. Ин танҳо
-- аз назари корбар пинҳон мекунад — маълумоти аслӣ (item_verification_attempts
-- ё items-и дигар корбар) дигар намемонад, чунки онҳо барои соҳиби эълон/
-- нашри умумӣ лозиманд. Пеш аз пинҳон шудан, як snapshot дар архиви admin
-- захира мешавад, то admin бинад кӣ кай чӣ огоҳиномаро нест кардааст.
-- ============================================================================

create table if not exists public.dismissed_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  kind       text not null check (kind in ('verification', 'category_post')),
  ref_id     uuid not null, -- attempt_id барои verification, item_id барои category_post
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);
create index if not exists idx_dismissed_notifications_lookup on public.dismissed_notifications(user_id, kind, ref_id);

-- Танҳо тавассути RPC (security definer) навишта мешавад — RLS бе policy = deny.
alter table public.dismissed_notifications enable row level security;

create table if not exists public.deleted_notifications_archive (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  kind           text not null,
  ref_id         uuid not null,
  item_id        uuid,
  item_title     text,
  related_name   text,
  related_avatar text,
  status         text,
  deleted_at     timestamptz not null default now()
);
create index if not exists idx_deleted_notifications_archive_deleted_at on public.deleted_notifications_archive(deleted_at desc);

-- Service-role only (admin API), ҳамон тавре ки дигар archive-ҳо (deleted_items_archive ва ғ.)
alter table public.deleted_notifications_archive enable row level security;

-- RPC: корбар огоҳиномаро "нест" мекунад — якбора ҳам dismiss (пинҳон аз
-- рӯйхаташ) ва ҳам snapshot дар архиви admin, дар як транзаксия.
create or replace function public.dismiss_notification(
  p_kind text,
  p_ref_id uuid,
  p_item_id uuid,
  p_item_title text,
  p_related_name text,
  p_related_avatar text,
  p_status text default null
)
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
  if p_kind not in ('verification', 'category_post') then
    raise exception 'Invalid kind';
  end if;

  insert into dismissed_notifications (user_id, kind, ref_id)
  values (v_user_id, p_kind, p_ref_id)
  on conflict (user_id, kind, ref_id) do nothing;

  insert into deleted_notifications_archive
    (user_id, kind, ref_id, item_id, item_title, related_name, related_avatar, status)
  values
    (v_user_id, p_kind, p_ref_id, p_item_id, p_item_title, p_related_name, p_related_avatar, p_status);
end;
$$;

grant execute on function public.dismiss_notification(text, uuid, uuid, text, text, text, text) to authenticated;

-- Ду RPC-и мавҷударо нав мекунем, то огоҳиномаҳои нестшуда дигар барнагарданд.
drop function if exists public.get_my_verification_attempts(int);
create or replace function public.get_my_verification_attempts(p_limit int default 50)
returns table (
  id uuid,
  item_id uuid,
  item_title text,
  answers jsonb,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  claimant_phone text,
  matched_user_id text,
  matched_first_name text,
  matched_last_name text,
  matched_avatar_url text,
  item_image_url text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select
      a.id, a.item_id, i.title, a.answers, a.status, a.created_at, a.reviewed_at, a.claimant_phone,
      coalesce(m_token.id, m_phone.id),
      coalesce(m_token.first_name, m_phone.first_name),
      coalesce(m_token.last_name, m_phone.last_name),
      coalesce(m_token.avatar_url, m_phone.avatar_url),
      img.image_url
    from public.item_verification_attempts a
    join public.items i on i.id = a.item_id
    left join lateral (
      select p.id, p.first_name, p.last_name, p.avatar_url
      from public.profiles p
      where a.claimant_token like 'user\_%' escape '\'
        and p.id = substring(a.claimant_token from 6)
      limit 1
    ) m_token on true
    left join lateral (
      select p.id, p.first_name, p.last_name, p.avatar_url
      from public.profiles p
      where m_token.id is null
        and a.claimant_phone is not null
        and (p.phone = a.claimant_phone or p.secondary_phone = a.claimant_phone)
      limit 1
    ) m_phone on true
    left join lateral (
      select ii.image_url from public.item_images ii where ii.item_id = i.id order by ii.created_at asc limit 1
    ) img on true
    where i.user_id = get_auth_id()
      and (i.status is null or i.status <> 'deleted')
      and not exists (
        select 1 from public.dismissed_notifications d
        where d.user_id = get_auth_id() and d.kind = 'verification' and d.ref_id = a.id
      )
    order by a.created_at desc
    limit p_limit;
end;
$$;

drop function if exists public.get_my_category_notifications(int);
create or replace function public.get_my_category_notifications(p_limit int default 20)
returns table (
  item_id uuid,
  item_title text,
  category text,
  created_at timestamptz,
  poster_id text,
  poster_first_name text,
  poster_last_name text,
  poster_avatar_url text,
  item_image_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    i.id, i.title, i.category, i.created_at,
    p.id, p.first_name, p.last_name, p.avatar_url,
    img.image_url
  from public.items i
  join public.profiles p on p.id = i.user_id
  left join lateral (
    select ii.image_url from public.item_images ii where ii.item_id = i.id order by ii.created_at asc limit 1
  ) img on true
  where i.moderation_status = 'approved'
    and (i.status is null or i.status <> 'deleted')
    and i.user_id <> get_auth_id()
    and exists (
      select 1 from public.items mine
      where mine.user_id = get_auth_id()
        and mine.category = i.category
        and mine.type <> i.type
        and mine.moderation_status = 'approved'
        and (mine.status is null or mine.status <> 'deleted')
    )
    and not exists (
      select 1 from public.dismissed_notifications d
      where d.user_id = get_auth_id() and d.kind = 'category_post' and d.ref_id = i.id
    )
  order by i.created_at desc
  limit p_limit;
$$;
