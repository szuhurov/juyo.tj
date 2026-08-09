-- match_item_images() то ҳол ҳеҷ шарти moderation_status/status намедошт —
-- эълони "pending"/"rejected" ё "deleted" низ метавонист дар натиҷаи
-- ҷустуҷӯи визуалӣ (барои ҲАМАИ корбарон, на танҳо соҳиб) пайдо шавад.
-- Ин мутобиқ ба search_items/get_my_category_notifications нест, ки ин
-- филтрҳоро доранд.

create or replace function public.match_item_images(
  query_embedding vector,
  match_threshold double precision,
  match_count integer,
  p_type text default 'all'
)
returns table(id uuid, item_id uuid, image_url text, similarity double precision, title text, description text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    img.id, img.item_id, img.image_url,
    1 - (img.embedding <=> query_embedding) as similarity,
    i.title, i.description
  from public.item_images img
  join public.items i on img.item_id = i.id
  where (p_type = 'all' or i.type::text = p_type)
    and i.is_resolved = false
    and i.moderation_status = 'approved'
    and (i.status is null or i.status <> 'deleted')
    and img.embedding is not null
    and 1 - (img.embedding <=> query_embedding) > match_threshold
  order by img.embedding <=> query_embedding
  limit match_count;
end;
$$;
