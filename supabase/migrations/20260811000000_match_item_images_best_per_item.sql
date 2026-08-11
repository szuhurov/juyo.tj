-- Аз ҳар ашё танҳо БЕҲТАРИН акс бармегардад.
--
-- generate-embedding акнун ҳамаи аксҳои ашёро вектор мекунад (пеш аз ин
-- танҳо аввалинро). Бе ин distinct, ашёи сеаксдор метавонист се маротиба
-- дар натиҷаи ҷустуҷӯ пайдо шавад ва ҷои ашёи дигарро гирад.
create or replace function public.match_item_images(
  query_embedding vector,
  match_threshold double precision,
  match_count integer,
  p_type text default 'all'::text
)
returns table(
  id uuid,
  item_id uuid,
  image_url text,
  similarity double precision,
  title text,
  description text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  with ranked as (
    select distinct on (img.item_id)
      img.id,
      img.item_id,
      img.image_url,
      1 - (img.embedding <=> query_embedding) as similarity,
      i.title,
      i.description
    from public.item_images img
    join public.items i on img.item_id = i.id
    where (p_type = 'all' or i.type::text = p_type)
      and i.is_resolved = false
      and i.moderation_status = 'approved'
      and (i.status is null or i.status <> 'deleted')
      and img.embedding is not null
      and 1 - (img.embedding <=> query_embedding) > match_threshold
    order by img.item_id, img.embedding <=> query_embedding
  )
  select ranked.id, ranked.item_id, ranked.image_url,
         ranked.similarity, ranked.title, ranked.description
  from ranked
  order by ranked.similarity desc
  limit match_count;
end;
$function$;
