-- Owner decision 2026-10-06: no automatic text moderation — every listing is
-- reviewed by an admin anyway. Removes everything 20261004000000 created.
-- App builds that still call check_listing_text treat a missing function as
-- "no check" and continue (lib/text-moderation.ts returns null).

drop trigger if exists items_text_moderation_trigger on public.items;
drop function if exists public.items_text_moderation();
drop function if exists public.check_listing_text(text, text);

drop trigger if exists moderation_terms_compile_trigger on public.moderation_terms;
drop function if exists public.moderation_terms_compile();
drop table if exists public.moderation_terms;
drop function if exists public.moderation_term_pattern(text, text);
drop function if exists public.moderation_fold_lat(text);
drop function if exists public.moderation_fold_cyr(text);

alter table public.items drop column if exists text_moderation;
