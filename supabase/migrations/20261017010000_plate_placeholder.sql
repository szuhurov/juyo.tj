-- Owner decision 2026-10-17: a licence-plate listing gets no photo either —
-- the JUYO plate image (https://juyo.tj/placeholders/plate.png) with the
-- number the poster typed drawn on it (lib/photo-policy.ts in both clients).
--
-- Only photo_placeholder_url() changes, so the existing triggers apply the
-- rule to plates from now on: a new photo of a LicensePlate listing becomes
-- the plate image, and moving a listing into LicensePlate replaces its photos.
-- Existing LicensePlate listings are NOT converted (their photos stay until
-- they are edited) — unlike 20261007030000, nothing is deleted here.
-- Rollback: restore the two-category version of the function.

create or replace function public.photo_placeholder_url(p_category text)
returns text language sql immutable as $$
  select case
    when p_category = 'Cards' then 'https://juyo.tj/placeholders/card.png'
    when p_category = 'Documents' then 'https://juyo.tj/placeholders/document.png'
    when p_category = 'LicensePlate' then 'https://juyo.tj/placeholders/plate.png'
  end;
$$;
