-- ============================================================================
-- Мутобиқсозии даъвогар (claimant) бо ҳисоби JUYO танҳо аз рӯи рақами
-- телефон буд — агар рақами дар анкета воридкардашуда бо профил каме фарқ
-- кунад (масалан формат), даъвогари воқеан вориди ҳисоби худ шуда низ
-- "Корбари номаълум" нишон дода мешуд. item_verification_attempts.claimant_token
-- аллакай ID-и Clerk-и дурустро дар бар мегирад (агар вориди ҳисоб буда
-- бошад — "user_<id>", ниг. verification-gate.tsx: getClaimantToken()) —
-- ин бояд манбаи АСОСӢ бошад, рақами телефон танҳо fallback барои
-- даъвогарони анонимӣ.
-- ============================================================================

create or replace function public.get_pending_verification_attempts(p_item_id uuid)
returns table(
  id uuid,
  answers jsonb,
  status text,
  created_at timestamptz,
  claimant_phone text,
  matched_user_id text,
  matched_first_name text,
  matched_last_name text,
  matched_avatar_url text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.items where items.id = p_item_id and items.user_id = get_auth_id()) then
    raise exception 'Not authorized';
  end if;

  return query
    select
      a.id, a.answers, a.status, a.created_at, a.claimant_phone,
      coalesce(m_token.id, m_phone.id),
      coalesce(m_token.first_name, m_phone.first_name),
      coalesce(m_token.last_name, m_phone.last_name),
      coalesce(m_token.avatar_url, m_phone.avatar_url)
    from public.item_verification_attempts a
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
    where a.item_id = p_item_id and a.status = 'pending_review'
    order by a.created_at desc;
end;
$$;
grant execute on function public.get_pending_verification_attempts(uuid) to authenticated;

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
  matched_avatar_url text
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
      coalesce(m_token.avatar_url, m_phone.avatar_url)
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
    where i.user_id = get_auth_id()
      and (i.status is null or i.status <> 'deleted')
    order by a.created_at desc
    limit p_limit;
end;
$$;
grant execute on function public.get_my_verification_attempts(int) to authenticated;
