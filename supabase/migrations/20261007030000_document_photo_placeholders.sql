-- Owner decision 2026-10-07: no photo of a document or a payment card is
-- ever published. On real Tajik ID cards and bank cards the on-device OCR
-- missed embossed, turned and mirrored numbers on 9 of 16 photos, so
-- Documents and Cards listings show a JUYO image instead
-- (https://juyo.tj/placeholders/document.png | card.png, lib/photo-policy.ts).
--
-- The apps no longer upload such photos; this enforces it for every client
-- (old builds, modified clients, admin tools):
--   1. a photo row for a Documents/Cards listing becomes the placeholder
--      (one per listing — extra rows are dropped);
--   2. moving a listing into Documents/Cards replaces its photos with the
--      placeholder; moving it out removes the placeholder;
--   3. existing Documents/Cards listings are converted now. Their photo
--      files are removed from Storage separately (service role, same day).

create or replace function public.photo_placeholder_url(p_category text)
returns text language sql immutable as $$
  select case
    when p_category = 'Cards' then 'https://juyo.tj/placeholders/card.png'
    when p_category = 'Documents' then 'https://juyo.tj/placeholders/document.png'
  end;
$$;

-- 1. item_images: only the placeholder may belong to a Documents/Cards listing.
create or replace function public.item_images_document_placeholder()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_placeholder text;
begin
  select public.photo_placeholder_url(i.category) into v_placeholder
    from public.items i where i.id = new.item_id;
  if v_placeholder is null then
    return new;
  end if;
  new.image_url := v_placeholder;
  new.thumbnail_url := v_placeholder;
  if tg_op = 'INSERT' and exists (select 1 from public.item_images where item_id = new.item_id) then
    return null;
  end if;
  return new;
end;
$$;
revoke all on function public.item_images_document_placeholder() from public, anon, authenticated;

drop trigger if exists item_images_document_placeholder_trigger on public.item_images;
create trigger item_images_document_placeholder_trigger
  before insert or update of image_url, thumbnail_url on public.item_images
  for each row execute function public.item_images_document_placeholder();

-- 2. items: changing the category in or out of Documents/Cards.
create or replace function public.items_category_photo_policy()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_new text := public.photo_placeholder_url(new.category);
  v_old text := public.photo_placeholder_url(old.category);
begin
  if v_new is not null then
    delete from public.item_images
     where item_id = new.id and image_url is distinct from v_new;
    if not exists (select 1 from public.item_images where item_id = new.id) then
      insert into public.item_images (item_id, image_url, thumbnail_url) values (new.id, v_new, v_new);
    end if;
  elsif v_old is not null then
    delete from public.item_images
     where item_id = new.id and image_url like 'https://juyo.tj/placeholders/%';
  end if;
  return null;
end;
$$;
revoke all on function public.items_category_photo_policy() from public, anon, authenticated;

drop trigger if exists items_category_photo_policy_trigger on public.items;
create trigger items_category_photo_policy_trigger
  after update of category on public.items
  for each row when (old.category is distinct from new.category)
  execute function public.items_category_photo_policy();

-- 3. Existing Documents/Cards listings (every status): photos → placeholder.
delete from public.item_images ii
 using public.items i
 where i.id = ii.item_id
   and public.photo_placeholder_url(i.category) is not null
   and ii.image_url is distinct from public.photo_placeholder_url(i.category);

insert into public.item_images (item_id, image_url, thumbnail_url)
select i.id, public.photo_placeholder_url(i.category), public.photo_placeholder_url(i.category)
  from public.items i
 where public.photo_placeholder_url(i.category) is not null
   and not exists (select 1 from public.item_images ii where ii.item_id = i.id);
