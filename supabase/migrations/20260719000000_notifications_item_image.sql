-- ============================================================================
-- Огоҳиномаҳо акнун дар саҳифаи /notifications ба ҷои гузариш ба
-- item-by-id, дар ҳамон рӯйхат кушода мешаванд ва аксаи эълонро нишон
-- медиҳанд — барои ин ду RPC-и огоҳиномаҳо аксаи аввали ҳар эълонро низ
-- бояд баргардонанд.
-- ============================================================================

drop function if exists public.get_my_verification_attempts(int);
drop function if exists public.get_my_category_notifications(int);

create or replace function public.get_my_verification_attempts(p_limit int default 50)
returns table(
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
stable
security definer
set search_path = public
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
    order by a.created_at desc
    limit p_limit;
end;
$$;
grant execute on function public.get_my_verification_attempts(int) to authenticated;

create or replace function public.get_my_category_notifications(p_limit int default 20)
returns table(
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
stable
security definer
set search_path = public
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
    and i.category in (
      select distinct category from public.items
      where user_id = get_auth_id()
        and moderation_status = 'approved'
        and (status is null or status <> 'deleted')
    )
  order by i.created_at desc
  limit p_limit;
$$;
grant execute on function public.get_my_category_notifications(int) to authenticated;
