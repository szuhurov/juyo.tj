-- ============================================================================
-- get_pending_verification_attempts(p_item_id) буд, ки танҳо як эълон ва
-- танҳо pending_review-ро мегардонд. Занги огоҳиномаҳо (NotificationBell)
-- ба як RPC ниёз дорад, ки ҲАМАИ эълонҳои корбарро якҷоя пӯшонад ва ҳам
-- pending, ҳам аллакай баррасишударо (таърих — то аз рӯйхат нест нашавад)
-- баргардонад.
-- ============================================================================

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
      m.id, m.first_name, m.last_name, m.avatar_url
    from public.item_verification_attempts a
    join public.items i on i.id = a.item_id
    left join lateral (
      select p.id, p.first_name, p.last_name, p.avatar_url
      from public.profiles p
      where a.claimant_phone is not null
        and (p.phone = a.claimant_phone or p.secondary_phone = a.claimant_phone)
      limit 1
    ) m on true
    where i.user_id = get_auth_id()
    order by a.created_at desc
    limit p_limit;
end;
$$;

grant execute on function public.get_my_verification_attempts(int) to authenticated;
