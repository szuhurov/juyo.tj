-- Owner decision 2026-10-07: no automatic image moderation — an admin looks
-- at every listing before it is published anyway. Removes everything
-- 20261007010000_image_moderation and 20261007010001 created. Visual search
-- (image_embeddings, search_visual, set_image_embedding) stays.

drop trigger if exists image_embeddings_moderate on public.image_embeddings;
drop function if exists public.moderate_image_embedding();
drop function if exists public.admin_bulk_approve(jsonb, text);
drop function if exists public.admin_safe_candidates(int);
drop function if exists public.moderation_score(text, vector);
drop table if exists public.image_moderation;
drop table if exists public.moderation_heads;
drop table if exists public.moderation_models;

-- enforce_moderation_status as it was before 20261007010000 (that migration
-- only added a bypass for the moderation trigger removed above).
create or replace function public.enforce_moderation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_privileged boolean;
  v_content_changed boolean;
begin
  v_privileged := (
    current_setting('request.jwt.claims', true) is null
    or (current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role'
  );

  if v_privileged then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    new.moderation_status := 'pending';
    new.moderation_result := null;
    return new;
  end if;

  if new.moderation_status is distinct from old.moderation_status then
    if new.moderation_status = 'pending' then
      new.moderation_result := null;
    else
      new.moderation_status := old.moderation_status;
      new.moderation_result := old.moderation_result;
    end if;
    return new;
  end if;

  v_content_changed := (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.category is distinct from old.category
  );

  if v_content_changed and old.moderation_status <> 'pending' then
    new.moderation_status := 'pending';
    new.moderation_result := null;
  end if;

  return new;
end;
$$;
