-- ============================================================================
-- JUYO.TJ — Сохти пурраи базаи маълумот (Production, PostgreSQL/Supabase)
-- Санаи баровардан: 29 июли 2026
-- Танҳо сохт (schema) — ҳеҷ маълумоти шахсии корбарон дар ин файл нест.
-- ============================================================================

-- ── Навъҳои махсус (Enums) ──────────────────────────────────────────────────
create type public.item_type as enum ('lost', 'found');
create type public.moderation_status as enum ('pending', 'approved', 'rejected');

-- ── Профили корбарон (синхронизатсия аз Clerk) ──────────────────────────────
CREATE TABLE public.profiles (
  id text NOT NULL,
  first_name text,
  last_name text,
  avatar_url text,
  phone text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  secondary_phone text,
  accepted_terms boolean DEFAULT false,
  accepted_at timestamp with time zone,
  terms_version text,
  secondary_phone_type text,
  is_qr_active boolean DEFAULT true,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'blocked'::text, 'deleted'::text])),
  deleted_at timestamp with time zone,
  email text,
  last_login_at timestamp with time zone,
  qr_activation_count integer NOT NULL DEFAULT 0,
  qr_scan_count integer NOT NULL DEFAULT 0,
  is_verified boolean NOT NULL DEFAULT false,
  moderation_exempt boolean NOT NULL DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

-- ── Намои ҷамъиятии профил (маълумоти маҳдуд, барои корбарони дигар) ────────
create view public.public_profiles as
select id, first_name, last_name, avatar_url, created_at, is_verified
from public.profiles;

-- ── Эълонҳо (ашёи гумшуда/ёфташуда) ──────────────────────────────────────────
CREATE TABLE public.items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  type USER-DEFINED NOT NULL DEFAULT 'lost'::item_type,
  date date NOT NULL DEFAULT CURRENT_DATE,
  reward text,
  phone_number text,
  is_resolved boolean DEFAULT false,
  views integer DEFAULT 0,
  moderation_status USER-DEFINED DEFAULT 'pending'::moderation_status,
  moderation_result text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_guest boolean DEFAULT false,
  expires_at timestamp with time zone,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'deleted'::text])),
  deleted_at timestamp with time zone,
  CONSTRAINT items_pkey PRIMARY KEY (id),
  CONSTRAINT items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- ── Аксҳои эълонҳо (бо AI embedding барои ҷустуҷӯи визуалӣ) ──────────────────
CREATE TABLE public.item_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid,
  image_url text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  embedding USER-DEFINED,
  CONSTRAINT item_images_pkey PRIMARY KEY (id),
  CONSTRAINT item_images_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);

-- ── Элонҳои захирашуда аз ҷониби корбар ──────────────────────────────────────
CREATE TABLE public.saved_items (
  user_id text NOT NULL,
  item_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT saved_items_pkey PRIMARY KEY (user_id, item_id),
  CONSTRAINT saved_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT saved_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);

-- ── Токенҳои push-огоҳинома (Expo + web) ─────────────────────────────────────
CREATE TABLE public.push_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  platform text NOT NULL CHECK (platform = ANY (ARRAY['expo'::text, 'web'::text])),
  token text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_tokens_pkey PRIMARY KEY (id)
);

-- ── Архиви ҳисобҳои нестшуда (snapshot пеш аз нест кардани пурра) ────────────
CREATE TABLE public.deleted_accounts_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  profile_snapshot jsonb NOT NULL,
  items_count integer NOT NULL DEFAULT 0,
  deleted_at timestamp with time zone DEFAULT now(),
  CONSTRAINT deleted_accounts_archive_pkey PRIMARY KEY (id)
);

-- ── Архиви эълонҳои нестшуда ──────────────────────────────────────────────────
CREATE TABLE public.deleted_items_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  item_snapshot jsonb NOT NULL,
  deleted_at timestamp with time zone DEFAULT now(),
  CONSTRAINT deleted_items_archive_pkey PRIMARY KEY (id)
);

-- ── Элонҳои воридотӣ аз манбаъҳои берунӣ (Somon.tj, Telegram) ───────────────
CREATE TABLE public.external_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  external_id text NOT NULL,
  source text NOT NULL DEFAULT 'Somon.tj'::text,
  title text NOT NULL,
  description text,
  images ARRAY NOT NULL DEFAULT '{}'::text[],
  category text,
  type text CHECK (type = ANY (ARRAY['lost'::text, 'found'::text])),
  location text,
  published_at timestamp with time zone,
  source_url text NOT NULL,
  raw_data jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  phone_number text,
  published_item_id uuid,
  source_channel text NOT NULL DEFAULT ''::text,
  telegram_message_id bigint,
  ai_confidence numeric,
  CONSTRAINT external_items_pkey PRIMARY KEY (id),
  CONSTRAINT external_items_published_item_id_fkey FOREIGN KEY (published_item_id) REFERENCES public.items(id)
);

-- ── Танзимоти умумии барнома (як сатр — feature flags) ───────────────────────
CREATE TABLE public.app_settings (
  id boolean NOT NULL DEFAULT true CHECK (id),
  ai_moderation_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (id)
);

-- ── Огоҳиномаҳои радшуда/дидашуда аз ҷониби корбар ────────────────────────────
CREATE TABLE public.dismissed_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['verification'::text, 'category_post'::text])),
  ref_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dismissed_notifications_pkey PRIMARY KEY (id)
);

-- ── Архиви огоҳиномаҳои нестшуда ──────────────────────────────────────────────
CREATE TABLE public.deleted_notifications_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  kind text NOT NULL,
  ref_id uuid NOT NULL,
  item_id uuid,
  item_title text,
  related_name text,
  related_avatar text,
  status text,
  deleted_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT deleted_notifications_archive_pkey PRIMARY KEY (id)
);

-- ── Репортҳои элонҳо (аз ҷониби корбарон) ─────────────────────────────────────
CREATE TABLE public.item_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  reporter_id text NOT NULL,
  reason text NOT NULL CHECK (reason = ANY (ARRAY['spam'::text, 'inappropriate'::text, 'fake'::text, 'offensive'::text, 'other'::text])),
  details text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'dismissed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_reports_pkey PRIMARY KEY (id),
  CONSTRAINT item_reports_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);

-- ── Корбарони блокшуда (аз ҷониби корбарони дигар) ────────────────────────────
CREATE TABLE public.user_blocks (
  blocker_id text NOT NULL,
  blocked_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id)
);

-- ── Дархостҳои нест кардани account (тавассути /delete-account) ──────────────
CREATE TABLE public.account_deletion_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processed'::text, 'rejected'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT account_deletion_requests_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- Хулоса: 14 ҷадвал + 1 view (public_profiles), ҳамаашон бо Row Level
-- Security (RLS) фаъол. Хусусиятҳои иловагӣ дар database (на дар ин файл,
-- аммо қисми система):
--   - Postgres trigger-ҳо барои push-огоҳинома ва AI moderation (pg_net)
--   - Supabase Vault барои нигоҳ доштани калидҳои дохилии trigger-ҳо
--   - moderation_exempt: агар true, элонҳои корбар бе AI moderation худкор
--     "тасдиқшуда" мешаванд (хусусияти "трастшуда постер")
--   - Extension-ҳо: pgcrypto, pg_trgm, vector (AI embeddings), pg_net, pg_cron
-- ============================================================================
