-- City filter: every listing gets a city (fixed list of Tajikistan cities),
-- and search_items gets an optional p_city filter. 18 official cities; the
-- display order (Dushanbe first, then by population/importance) lives in the
-- clients, not here.
--
-- Existing listings (111 at the time of writing) are all from Dushanbe, so
-- they are back-filled with 'dushanbe', and the column default makes any
-- insert from an older client that doesn't send a city land there as well.
-- Old clients that call search_items without p_city keep working (p_city
-- defaults to null = no city filter).
--
-- Rollback (kept here so it is next to the change):
--   begin;
--   drop function if exists public.search_items(text,text,text,text,integer,integer,date,date,text,text);
--   -- re-create the previous 9-argument search_items from
--   -- 20260914000000_search_items_location_none.sql
--   alter table public.items drop constraint if exists items_city_check;
--   alter table public.items drop column if exists city;
--   commit;
begin;

alter table public.items add column if not exists city text;
update public.items set city = 'dushanbe' where city is null;
alter table public.items alter column city set default 'dushanbe';
alter table public.items alter column city set not null;

alter table public.items drop constraint if exists items_city_check;
alter table public.items add constraint items_city_check check (city in (
  'dushanbe', 'khujand', 'bokhtar', 'kulob', 'tursunzoda', 'istaravshan',
  'vahdat', 'hisor', 'panjakent', 'khorugh', 'isfara', 'konibodom',
  'norak', 'roghun', 'guliston', 'buston', 'istiqlol', 'levakant'
));

-- A new argument means a new signature; drop the old one so PostgREST never
-- has two overloads to choose between.
drop function if exists public.search_items(text,text,text,text,integer,integer,date,date,text);

create function public.search_items(
  p_search text default null,
  p_category text default null,
  p_type text default null,
  p_user_id text default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_date_from date default null,
  p_date_to date default null,
  p_location_type text default null,
  p_city text default null
)
returns table(
  id uuid, user_id text, title text, description text, category text,
  type item_type, date date, reward text, created_at timestamptz,
  is_resolved boolean, moderation_status moderation_status, images jsonb
)
language sql
stable
as $function$
  select
    i.id, i.user_id, i.title, i.description, i.category, i.type, i.date,
    i.reward, i.created_at, i.is_resolved, i.moderation_status,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('image_url', img.image_url, 'thumbnail_url', img.thumbnail_url) order by img.created_at)
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
    and (
      p_location_type is null
      or (p_location_type = 'none' and i.location_type is null)
      or i.location_type = p_location_type
    )
    and (p_city is null or i.city = p_city)
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
    i.created_at desc,
    i.id
  limit p_limit
  offset p_offset;
$function$;

grant execute on function public.search_items(text,text,text,text,integer,integer,date,date,text,text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
