-- get_my_category_notifications то ҳол танҳо аз рӯи category + type-и муқобил
-- мутобиқат мекард — дар категорияи васеъ (Electronics, Clothing, Other) ду
-- ашёи тамоман гуногун (масалан "гумшуда ҳамён" ва "ёфташуда чатр") низ ба
-- ҳам notification мефиристоданд, чунки category якхела буд, бе ҳеҷ назардошти
-- матн. Ин RPC бе AI (pg_trgm — функсияи детерминии худи Postgres, on-line
-- аллакай фаъол аст, ниг. baseline_schema.sql) як қабати мувофиқати матнӣ
-- илова мекунад: барои категорияҳои ВАСЕЪ, ба ҷуз category+type, title/
-- description-и ашёи нав бояд бо яке аз ашёҳои худи корбар дар ҳамон
-- категория ҳадди ақал андозаи similarity дошта бошад. Категорияҳои
-- МУШАХХАС (Documents, Keys, Pets, LicensePlate, Wallet) чунин филтр
-- намегиранд — дар онҷо тақрибан ҳар чиз воқеан наздик аст, category+type
-- кофист.

create index if not exists idx_items_title_trgm on public.items using gin (title gin_trgm_ops);
create index if not exists idx_items_description_trgm on public.items using gin (description gin_trgm_ops);

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
        and (
          -- категорияи мушаххас — category+type кофист
          i.category not in ('Electronics', 'Clothing', 'Other')
          -- категорияи васеъ — бояд монандии матнӣ низ бошад
          or similarity(mine.title, i.title) > 0.15
          or similarity(coalesce(mine.description, ''), coalesce(i.description, '')) > 0.1
        )
    )
    and not exists (
      select 1 from public.dismissed_notifications d
      where d.user_id = get_auth_id() and d.kind = 'category_post' and d.ref_id = i.id
    )
  order by i.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_my_category_notifications(integer) to authenticated;
