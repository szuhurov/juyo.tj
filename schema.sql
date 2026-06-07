-- Сохтори таблитсаҳои базаи маълумот (PostgreSQL).
-- Ҳамаи майдонҳо ва робитаҳои байни таблитсаҳо дар ин ҷоянд.

-- СБРОС: Удаляем старое (если нужно начать с чистого листа)
-- DROP TABLE IF EXISTS public.item_images CASCADE;
-- DROP TABLE IF EXISTS public.saved_items CASCADE;
-- DROP TABLE IF EXISTS public.items CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;
-- DROP TABLE IF EXISTS public.safety_box CASCADE;

-- 1. Создаем расширения
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Создаем типы данных
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

-- Намоиши бехатар (Public Profiles View)
-- Ин маълумоти ҳассосро (phone) пинҳон мекунад
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, first_name, last_name, avatar_url, created_at
FROM public.profiles;

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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(reward, '')), 'C')
    ) STORED
);

-- Индекс барои ҷустуҷӯи Full Text
CREATE INDEX IF NOT EXISTS idx_items_search_vector ON public.items USING GIN(search_vector);

-- 4. Таблица ITEM_IMAGES
CREATE TABLE IF NOT EXISTS public.item_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    embedding vector(1536), -- Барои OpenAI text-embedding-3-small ё CLIP
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Функция барои ҷустуҷӯи монандӣ (Vector Similarity Search)
CREATE OR REPLACE FUNCTION match_item_images (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_type text  -- 'lost', 'found', or 'all' (matches both)
)
RETURNS TABLE (
  id UUID,
  item_id UUID,
  image_url TEXT,
  similarity float,
  title TEXT,
  description TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    img.id,
    img.item_id,
    img.image_url,
    1 - (img.embedding <=> query_embedding) AS similarity,
    i.title,
    i.description
  FROM public.item_images img
  JOIN public.items i ON img.item_id = i.id
  WHERE (p_type = 'all' OR i.type::text = p_type)
    AND i.moderation_status = 'approved'
    AND i.is_resolved = false
    AND img.embedding IS NOT NULL
    AND 1 - (img.embedding <=> query_embedding) > match_threshold
  ORDER BY img.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

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
    type item_type NOT NULL DEFAULT 'lost',
    reward TEXT,
    phone_number TEXT,
    images TEXT[],
    views INTEGER DEFAULT 0,
    date DATE,
    text_moderated BOOLEAN DEFAULT FALSE,
    images_moderated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для скорости
CREATE INDEX IF NOT EXISTS idx_items_user_id ON public.items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON public.items(moderation_status);
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items(category);
CREATE INDEX IF NOT EXISTS idx_items_type ON public.items(type);
CREATE INDEX IF NOT EXISTS idx_items_is_resolved ON public.items(is_resolved);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON public.items(created_at DESC);
-- Compound index for the public feed query (moderation + resolved filter)
CREATE INDEX IF NOT EXISTS idx_items_feed ON public.items(moderation_status, is_resolved, created_at DESC);
-- Compound index for user item lookups
CREATE INDEX IF NOT EXISTS idx_items_user_created ON public.items(user_id, created_at DESC);

-- Trigger to auto-update updated_at on items
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_items_updated_at
BEFORE UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_safety_box_updated_at
BEFORE UPDATE ON public.safety_box
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RPC для просмотров
CREATE OR REPLACE FUNCTION public.increment_item_views(item_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.items
    SET views = views + 1
    WHERE id = item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
