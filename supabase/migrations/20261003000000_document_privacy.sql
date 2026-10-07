-- Document privacy (owner decision 2026-10-03): photos of documents are
-- published with personal details hidden, and nothing about them goes live
-- without an admin seeing it.
--
-- 1. Mask document / bank-card numbers in listing text on every write.
--    Same patterns as app/lib/sensitive-text.ts and Web/lib/sensitive-text.ts;
--    running it here also covers old app builds.
-- 2. Trusted posters are no longer auto-approved for the Documents category.
-- 3. A non-admin photo change on a published listing sends it back to review
--    (before this, text edits did but photo edits did not, so an approved
--    listing could swap in an unredacted photo). Trusted posters keep
--    their auto-approval outside the Documents category.
--
-- Existing listings are not rewritten here: an admin reviews the Documents
-- listings live, and saving one runs trigger 1.

create or replace function public.items_mask_sensitive_numbers()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pattern text := case when new.category = 'Documents'
    then '\d([ -]?\d){5,}'   -- 6+ digits: passport, ID, licence numbers
    else '\d([ -]?\d){12,}'  -- 13+ digits: bank cards
  end;
begin
  new.title := regexp_replace(new.title, v_pattern, '••••', 'g');
  new.description := regexp_replace(new.description, v_pattern, '••••', 'g');
  return new;
end;
$$;

drop trigger if exists items_mask_sensitive_numbers_trigger on public.items;
create trigger items_mask_sensitive_numbers_trigger
  before insert or update of title, description, category on public.items
  for each row execute function public.items_mask_sensitive_numbers();

create or replace function public.auto_approve_trusted_poster()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if NEW.moderation_status is distinct from 'pending' then
    return new;
  end if;
  -- Documents always wait for an admin, whoever posts them.
  if NEW.category = 'Documents' then
    return new;
  end if;
  if exists (select 1 from public.profiles where id = NEW.user_id and moderation_exempt is true) then
    update public.items
    set moderation_status = 'approved', moderation_result = 'Auto-approved (trusted poster)'
    where id = NEW.id;
  end if;
  return new;
end;
$$;

create or replace function public.item_images_require_review()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
begin
  -- Admin tools and server jobs (service role / no JWT) change photos
  -- without re-review — same rule as enforce_moderation_status().
  if v_claims is null or (v_claims::json ->> 'role') = 'service_role' then
    return null;
  end if;

  update public.items i
  set moderation_status = 'pending', moderation_result = null
  where i.id = new.item_id
    and i.moderation_status <> 'pending'
    and (
      i.category = 'Documents'
      or not exists (
        select 1 from public.profiles p where p.id = i.user_id and p.moderation_exempt is true
      )
    );
  return null;
end;
$$;

drop trigger if exists item_images_require_review_trigger on public.item_images;
create trigger item_images_require_review_trigger
  after insert or update of image_url on public.item_images
  for each row execute function public.item_images_require_review();
