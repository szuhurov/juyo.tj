-- ============================================================================
-- Эълони нав дар категорияи корбар пештара ТАНҲО push буд (notify-category-post),
-- дар менюи занг ҳеҷ сабт намемонд. Ин RPC ҳамон мантиқи гирандаро (ниг.
-- supabase/functions/notify-category-post) такрор мекунад, вале аз тарафи
-- худи корбар даъват мешавад — то дар менюи занг ҳам як рӯйхати доимӣ дошта
-- бошад (на танҳо як push-и гузаранда).
-- ============================================================================

create or replace function public.get_my_category_notifications(p_limit int default 20)
returns table(
  item_id uuid,
  item_title text,
  category text,
  created_at timestamptz,
  poster_id text,
  poster_first_name text,
  poster_last_name text,
  poster_avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id, i.title, i.category, i.created_at,
    p.id, p.first_name, p.last_name, p.avatar_url
  from public.items i
  join public.profiles p on p.id = i.user_id
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
