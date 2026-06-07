-- ============================================================
-- JUYO.TJ — Row Level Security (RLS) Policies
-- Clerk JWT: uses both 'user_id' and 'sub' claims via COALESCE
-- ============================================================

-- Фаъол кардани RLS барои ҳамаи ҷадвалҳо
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_images  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_box   ENABLE ROW LEVEL SECURITY;

-- ── Ёрирасон: гирифтани user_id аз JWT (COALESCE barои Clerk) ────────────
-- Clerk JWT метавонад user_id ё sub дошта бошад — ҳарду санҷида мешавад.

-- ============================================================
-- PUBLIC_PROFILES VIEW — дастрасии умумӣ ба ном ва аватар
-- ============================================================
-- Ин VIEW танҳо полҳои бехатарро нишон медиҳад (бе телефон).
-- security_invoker = false (SECURITY DEFINER) яъне VIEW аз номи postgres
-- иҷро мешавад ва RLS-и profiles-ро байпас мекунад.
-- Барои ин ба anon/authenticated GRANT медиҳем.
ALTER VIEW public.public_profiles SET (security_invoker = false);
GRANT SELECT ON public.public_profiles TO anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- ============================================================
-- PROFILES — тоза кардани ҳамаи policy-ҳои кӯҳна
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_public"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_manage"     ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles"  ON public.profiles;

-- Танҳо соҳиби профил маълумоти пурраашро (телефон ва ғ.) мебинад.
-- Корбарони дигар тавассути VIEW-и public_profiles ном ва аватарро мебинанд.
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
USING (
  COALESCE(
    current_setting('request.jwt.claims', true)::json->>'user_id',
    current_setting('request.jwt.claims', true)::json->>'sub'
  ) = id
);

CREATE POLICY "profiles_owner_manage"
ON public.profiles FOR ALL
USING (
  COALESCE(
    current_setting('request.jwt.claims', true)::json->>'user_id',
    current_setting('request.jwt.claims', true)::json->>'sub'
  ) = id
)
WITH CHECK (
  COALESCE(
    current_setting('request.jwt.claims', true)::json->>'user_id',
    current_setting('request.jwt.claims', true)::json->>'sub'
  ) = id
);

-- ============================================================
-- ITEMS — тоза кардани ҳамаи policy-ҳои кӯҳна
-- ============================================================
DROP POLICY IF EXISTS "items_select_visible"      ON public.items;
DROP POLICY IF EXISTS "items_owner_manage"        ON public.items;
DROP POLICY IF EXISTS "Public views approved items" ON public.items;
DROP POLICY IF EXISTS "Users manage own items"    ON public.items;

-- Ашёи approved ба ҳама нишон дода мешавад.
-- Ашёи pending/rejected танҳо ба соҳиби он нишон дода мешавад.
CREATE POLICY "items_select_visible"
ON public.items FOR SELECT
USING (
  moderation_status = 'approved'
  OR COALESCE(
    current_setting('request.jwt.claims', true)::json->>'user_id',
    current_setting('request.jwt.claims', true)::json->>'sub'
  ) = user_id
);

CREATE POLICY "items_owner_manage"
ON public.items FOR ALL
USING (
  COALESCE(
    current_setting('request.jwt.claims', true)::json->>'user_id',
    current_setting('request.jwt.claims', true)::json->>'sub'
  ) = user_id
)
WITH CHECK (
  COALESCE(
    current_setting('request.jwt.claims', true)::json->>'user_id',
    current_setting('request.jwt.claims', true)::json->>'sub'
  ) = user_id
);

-- ============================================================
-- ITEM_IMAGES — тоза кардани ҳамаи policy-ҳои кӯҳна
-- ============================================================
DROP POLICY IF EXISTS "images_select_visible"         ON public.item_images;
DROP POLICY IF EXISTS "images_owner_manage"           ON public.item_images;
DROP POLICY IF EXISTS "View images if item is visible" ON public.item_images;
DROP POLICY IF EXISTS "Manage own images"             ON public.item_images;

CREATE POLICY "images_select_visible"
ON public.item_images FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.id = item_images.item_id
    AND (
      items.moderation_status = 'approved'
      OR items.user_id = COALESCE(
        current_setting('request.jwt.claims', true)::json->>'user_id',
        current_setting('request.jwt.claims', true)::json->>'sub'
      )
    )
  )
);

CREATE POLICY "images_owner_manage"
ON public.item_images FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.id = item_images.item_id
    AND items.user_id = COALESCE(
      current_setting('request.jwt.claims', true)::json->>'user_id',
      current_setting('request.jwt.claims', true)::json->>'sub'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.id = item_images.item_id
    AND items.user_id = COALESCE(
      current_setting('request.jwt.claims', true)::json->>'user_id',
      current_setting('request.jwt.claims', true)::json->>'sub'
    )
  )
);

-- ============================================================
-- SAVED_ITEMS & SAFETY_BOX
-- ============================================================
DROP POLICY IF EXISTS "saved_items_owner_manage"  ON public.saved_items;
DROP POLICY IF EXISTS "Manage own saved items"    ON public.saved_items;
DROP POLICY IF EXISTS "safety_box_owner_manage"   ON public.safety_box;
DROP POLICY IF EXISTS "Manage own safety box"     ON public.safety_box;

CREATE POLICY "saved_items_owner_manage"
ON public.saved_items FOR ALL
USING (
  COALESCE(
    current_setting('request.jwt.claims', true)::json->>'user_id',
    current_setting('request.jwt.claims', true)::json->>'sub'
  ) = user_id
)
WITH CHECK (
  COALESCE(
    current_setting('request.jwt.claims', true)::json->>'user_id',
    current_setting('request.jwt.claims', true)::json->>'sub'
  ) = user_id
);

CREATE POLICY "safety_box_owner_manage"
ON public.safety_box FOR ALL
USING (
  COALESCE(
    current_setting('request.jwt.claims', true)::json->>'user_id',
    current_setting('request.jwt.claims', true)::json->>'sub'
  ) = user_id
)
WITH CHECK (
  COALESCE(
    current_setting('request.jwt.claims', true)::json->>'user_id',
    current_setting('request.jwt.claims', true)::json->>'sub'
  ) = user_id
);
