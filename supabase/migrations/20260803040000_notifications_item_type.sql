-- get_my_category_notifications: илова кардани item_type (lost/found) ба
-- натиҷа, то саҳифаи огоҳиномаҳо badge-и навъи эълонро нишон дода тавонад
-- (шумораи параметрҳо ва имзо тағйир намеёбад — танҳо RETURNS TABLE васеъ
-- мешавад, пас dropкунӣ лозим нест, чун ORDER OF COLUMNS-и қаблӣ нигоҳ дошта шуд).

drop function if exists public.get_my_category_notifications(integer);

create or replace function public.get_my_category_notifications(p_limit integer default 20)
returns table (
  item_id uuid,
  item_title text,
  category text,
  created_at timestamptz,
  poster_id text,
  poster_first_name text,
  poster_last_name text,
  poster_avatar_url text,
  item_image_url text,
  item_type item_type
)
language sql
stable
security definer
set search_path = 'public'
as $$
  select
    i.id, i.title, i.category, i.created_at,
    p.id, p.first_name, p.last_name, p.avatar_url,
    img.image_url,
    i.type
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

grant execute on function public.get_my_category_notifications(integer) to authenticated;
