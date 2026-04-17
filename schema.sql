-- СБРОС: Удаляем старое (если нужно начать с чистого листа)
-- DROP TABLE IF EXISTS public.item_images CASCADE;
-- DROP TABLE IF EXISTS public.saved_items CASCADE;
-- DROP TABLE IF EXISTS public.items CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;
-- DROP TABLE IF EXISTS public.safety_box CASCADE;

-- 1. Создаем типы данных
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_type') THEN
        CREATE TYPE item_type AS ENUM ('lost', 'found');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_status') THEN
        CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END $$;

-- 2. Таблица PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY, 
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    secondary_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Таблица ITEMS
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    type item_type NOT NULL DEFAULT 'lost',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    reward TEXT,
    phone_number TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    views INTEGER DEFAULT 0,
    moderation_status moderation_status DEFAULT 'pending',
    moderation_result TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Таблица ITEM_IMAGES
CREATE TABLE IF NOT EXISTS public.item_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Таблица SAVED_ITEMS
CREATE TABLE IF NOT EXISTS public.saved_items (
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, item_id)
);

-- 6. Таблица SAFETY_BOX
CREATE TABLE IF NOT EXISTS public.safety_box (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    type TEXT,
    reward TEXT,
    phone_number TEXT,
    images TEXT[], 
    views INTEGER DEFAULT 0,
    date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для скорости
CREATE INDEX IF NOT EXISTS idx_items_user_id ON public.items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON public.items(moderation_status);

-- RPC для просмотров
CREATE OR REPLACE FUNCTION public.increment_item_views(item_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.items
    SET views = views + 1
    WHERE id = item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
