-- search_items аз рӯи created_at (вақти воридкунӣ ба база) sort мекард, на
-- аз рӯи date (санаи воқеии гумшудан/ёфтшудани ашё). Барои итемҳои воридшуда
-- аз Telegram ин ду сана хеле фарқ мекунанд (масалан, created_at = имрӯз,
-- date = якчанд моҳ пеш) — натиҷа: лента бо санаи нишондодашуда дар
-- item-card мувофиқат намекард. Ҳоло аз рӯи date (нав → куҳна) sort
-- мешавад, created_at танҳо ҳамчун tie-breaker барои итемҳои дорои санаи
-- якхела.
create or replace function public.search_items(
  p_search text default null,
  p_category text default null,
  p_type text default null,
  p_user_id text default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_date_from date default null,
  p_date_to date default null
)
returns table (
  id uuid,
  user_id text,
  title text,
  description text,
  category text,
  type item_type,
  date date,
  reward text,
  created_at timestamptz,
  is_resolved boolean,
  moderation_status moderation_status,
  images jsonb
)
language sql
stable
as $$
  select
    i.id,
    i.user_id,
    i.title,
    i.description,
    i.category,
    i.type,
    i.date,
    i.reward,
    i.created_at,
    i.is_resolved,
    i.moderation_status,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('image_url', img.image_url) order by img.created_at)
        from item_images img
        where img.item_id = i.id
      ),
      '[]'::jsonb
    ) as images
  from items i
  where
    (i.status is null or i.status <> 'deleted')
    and (
      (p_user_id is not null and i.user_id = p_user_id)
      or (
        p_user_id is null
        and i.moderation_status = 'approved'
        and (i.is_resolved = false or i.is_resolved is null)
      )
    )
    and (p_category is null or p_category = 'All' or i.category = p_category)
    and (p_type is null or i.type::text = p_type)
    and (
      p_search is null or p_search = ''
      or i.title ilike '%' || p_search || '%'
      or i.description ilike '%' || p_search || '%'
    )
    and (p_date_from is null or i.created_at >= p_date_from::timestamptz)
    and (p_date_to is null or i.created_at < (p_date_to + 1)::timestamptz)
  order by
    case when p_search is not null and p_search <> '' then
      case
        when i.title ilike p_search then 0
        when i.title ilike p_search || '%' then 1
        when i.title ilike '%' || p_search || '%' then 2
        else 3
      end
    else 0
    end asc,
    i.date desc,
    i.created_at desc
  limit p_limit
  offset p_offset;
$$;

grant execute on function public.search_items(text, text, text, text, integer, integer, date, date) to anon, authenticated;
