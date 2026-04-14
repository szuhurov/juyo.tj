-- ========================================================
-- CLERK + SUPABASE RLS POLICIES (BULLETPROOF VERSION)
-- ========================================================

-- Включаем RLS для всех таблиц
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_box ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- PROFILES POLICIES
--------------------------------------------------------------------------------
CREATE POLICY "Anyone can view profiles" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can manage own profile" 
ON public.profiles FOR ALL 
USING ( (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')) = id );

--------------------------------------------------------------------------------
-- ITEMS POLICIES
--------------------------------------------------------------------------------
CREATE POLICY "Public views approved items" 
ON public.items FOR SELECT 
USING ( moderation_status = 'approved' OR (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')) = user_id );

CREATE POLICY "Users manage own items" 
ON public.items FOR ALL 
USING ( (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')) = user_id );

--------------------------------------------------------------------------------
-- ITEM_IMAGES POLICIES
--------------------------------------------------------------------------------
CREATE POLICY "View images if item is visible" 
ON public.item_images FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.items 
        WHERE items.id = item_images.item_id 
        AND (items.moderation_status = 'approved' OR items.user_id = (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')))
    )
);

CREATE POLICY "Manage own images" 
ON public.item_images FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.items 
        WHERE items.id = item_images.item_id 
        AND items.user_id = (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', ''))
    )
);

--------------------------------------------------------------------------------
-- SAVED_ITEMS & SAFETY_BOX POLICIES
--------------------------------------------------------------------------------
CREATE POLICY "Manage own saved items" 
ON public.saved_items FOR ALL 
USING ( (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')) = user_id );

CREATE POLICY "Manage own safety box" 
ON public.safety_box FOR ALL 
USING ( (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')) = user_id );
