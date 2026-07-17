# JUYO

## 📋 Феҳристи Мундариҷаaa

1. [🎯 Мақсади Лоиҳа](#-мақсади-лоиҳа)
2. [🛠 Технологияҳо (Tech Stack)](#-технологияҳо-tech-stack)
3. [🏗 Архитектураи Лоиҳа](#-архитектураи-лоиҳа)
4. [📂 Сохтори Файлҳо ва Тавсифи Муфассал](#-сохтори-файлҳо-ва-тавсифи-муфассал)
5. [🗄 Сохтори Базаи Маълумот](#-сохтори-базаи-маълумот)
6. [🔄 Ҷараёни Маълумот (Data Flow)](#-ҷараёни-маълумот-data-flow)
7. [🔐 Аутентификатсия ва Амният](#-аутентификатсия-ва-амният)



---

## 🎯 Мақсади Лоиҳа

**JUYO.TJ** як платформаи вебӣ барои **ёфтани ашёҳои гумшуда ва ёфтшуда** дар Тоҷикистон мебошад.

### 📌 Хусусиятҳои асосӣ:

- 🔍 **Ҷустуҷӯи осон ва зуд:** Корбарон метавонанд ашёҳои гумшуда ё ёфтшударо сабт ва ҷустуҷӯ кунанд
- 📸 **Сабти визуалӣ:** Илова кардани сурат барои беҳтар фаҳмидани ашё ва эътимоднокӣ
- 🏷️ **Категориябандӣ:** Электроника, ҳуҷҷатҳо, калидҳо, либос, ҳайвоноти хонагӣ ва ғайра
- 🌍 **Системаи дутарафа:** Бахшҳои **Lost (Гумшуда)** ва **Found (Ёфтшуда)** барои осон кардани пайвастшавӣ
- 📞 **Маълумоти тамос:** Иловаи рақами телефон ё роҳи тамос дар профил
- 🛡️ **Модератсия:** Санҷиши автоматии мундариҷа ва суратҳо барои амният
- 💬 **Системаи муошират:** Корбарон метавонанд дар зери эълонҳо шарҳ диҳанд ва маълумот гиранд

---


## 🛠 ТехнологИҳо (Stack)

```
┌─────────────────────────────────────────────────────────┐
│                   TECHNOLOGY STACK                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  FRONTEND:                BACKEND:                        │
│  ├─ Next.js              ├─ Supabase (PostgreSQL)        │
│  ├─ React                ├─ Supabase Functions (Deno)    │
│  ├─ TypeScript           ├─ Supabase Storage             │
│  ├─ Tailwind CSS         └─ Sightengine (Moderation)     │
│  ├─ React Query          │                                │
│  ├─ React Hook Form      EXTERNAL SERVICES:              │
│  ├─ Zod (Validation)     ├─ Clerk (Authentication)       │
│  ├─ Radix UI             ├─ Vercel (Hosting)             │
│  ├─ Sonner (Toast)       ├─ Vercel Analytics             │
│  ├─ Lucide Icons         └─ Unsplash (Images)            │
│  └─ date-fns             │                                │
│                           BROWSER:                        │
│  DATABASES:              └─ Next.js Client/Server        │
│  └─ Supabase             │                                │
│     └─ PostgreSQL        │                                │
└─────────────────────────────────────────────────────────┘
```

### Тавсифи Муҳим:

- **Next.js :** Framework-и пешрав барои React бо Server Components
- **TypeScript:** Забани барномасозӣ дахшам бо типҳо
- **React Query:** Идоракунии кэш ва синхронизатсия аз маълумот
- **Supabase:** BaaS (Backend as a Service) бо PostgreSQL
- **Clerk:** Сервиси аутентификатсия ва тадқиқи корбар
- **TailwindCSS:** Фреймворки CSS утилитаси

---

## 🏗 Архитектураи Лоиҳа

### Диаграмаи Созмони Фикрӣ:

```
┌─────────────────────────────────────────────────────────┐
│            VERCEL (Hosting & Edge Functions)             │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │          NEXT.JS APPLICATION                     │   │
│  ├────────────────────────────────────────────────┤   │
│  │  /app                  /components             │   │
│  │  ├─ (auth)            ├─ Header               │   │
│  │  ├─ (main)            ├─ ItemCard             │   │
│  │  ├─ qr                ├─ QueryProvider        │   │
│  │  └─ api               └─ UI Components        │   │
│  │                                                 │   │
│  │  /lib                                          │   │
│  │  ├─ services/         ├─ hooks/               │   │
│  │  │  ├─ item-service   │  └─ use-items        │   │
│  │  │  └─ profile-service│                      │   │
│  │  ├─ supabase.ts                              │   │
│  │  └─ translations.ts                           │   │
│  └──────────────────────────────────────────────────┘   │
│                           ↓                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │         AUTHENTICATION & IDENTITY                │   │
│  │              (Clerk SDK)                        │   │
│  │  ├─ JWT Token Generation                       │   │
│  │  └─ User Management                            │   │
│  └──────────────────────────────────────────────────┘   │
│                           ↓                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │         SUPABASE ECOSYSTEM                       │   │
│  ├────────────────────────────────────────────────┤   │
│  │  PostgreSQL Database:                         │   │
│  │  ├─ profiles    ├─ items                      │   │
│  │  └─ item_images └─ saved_items                │   │
│  │                                                 │   │
│  │  Storage:                                      │   │
│  │  └─ /items → Bucket for item images           │   │
│  │                                                 │   │
│  │  Edge Functions:                               │   │
│  │  ├─ clerk-sync → Syncs users from Clerk       │   │
│  │  └─ image-moderation → Validates images       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  External APIs:                                         │
│  ├─ Sightengine (Image Moderation)                     │
│  ├─ Vercel Analytics (Tracking)                        │
│  └─ Unsplash (Placeholder Images)                      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 📂 Сохтори Файлҳо

### Сохтори Дереҳҷории Каммалшуда:

```
juyo.tj/
│
├── app/                          # Next.js App Directory
│   ├── layout.tsx               # Root layout дар HTML-и главнӣ
│   ├── globals.css              # Услубҳои глобалии CSS
│   ├── (auth)/                  # Gruppe-и масираҳои аутентификатсия
│   │   ├── sign-in/
│   │   │   ├── [[...sign-in]]/  # Dynamic route барои Clerk SignIn
│   │   │   └── forgot-password/ # Саҳифаи забрдифамӣ рахнамӓй
│   │   └── sign-up/
│   │       └── [[...sign-up]]/  # Dynamic route барои Clerk SignUp
│   ├── (main)/                  # Gruppe-и масираҳои асосӣ
│   │   ├── layout.tsx           # Layout барои саҳифаҳои асосӣ
│   │   ├── loading.tsx          # Skeleton loading ҳингоми боргирӣ
│   │   ├── page.tsx             # Саҳифаи асосӣ (Home - рӯйхати эълонҳо)
│   │   ├── items/
│   │   │   ├── add/
│   │   │   │   └── page.tsx     # Саҳифаи сабти эълони нав
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # Тафсилоти эълон (сомон)
│   │   │       ├── item-details-client.tsx
│   │   │       └── edit/
│   │   │           └── page.tsx # Таҳрири эълон
│   │   ├── profile/
│   │   │   ├── page.tsx         # Саҳифаи профили корбар
│   │   │   ├── edit/
│   │   │   │   └── page.tsx     # Таҳрири маълумоти профил
│   │   │   └── my-posts/
│   │   │       └── page.tsx     # Эълонҳои худи корбар
│   │   └── qr/
│   │       └── [id]/
│   │           └── page.tsx     # Саҳифаи QR кодҳо барои эълонҳо
│   └── robots.ts                # SEO: robots.txt
│       sitemap.ts               # SEO: sitemap.xml
│
├── components/                  # React компонентҳо
│   ├── header.tsx              # Сарлавҳаи асосӣ (навигатсия)
│   ├── item-card.tsx           # Компонент - қуттии эълон
│   ├── query-provider.tsx       # Таъминкунандаи React Query
│   ├── network-status.tsx       # Синҷиши пайвастшавӣ ба интернет
│   ├── mandatory-phone-modal.tsx # Modal барои номи телефон (иловагӣ)
│   ├── qr-editor/
│   │   └── qr-card.tsx         # Компонент - редактори QR кодҳо
│   └── ui/                      # Радиус-Компонентҳои UI
│       ├── button.tsx           # Тугма
│       ├── card.tsx             # Қуттия
│       ├── input.tsx            # Майдони ворид
│       ├── form.tsx             # Форма
│       ├── dialog.tsx           # Modal/Popup
│       ├── dropdown-menu.tsx    # Менюи интихобшаванда
│       ├── avatar.tsx           # Сурати корбар
│       ├── badge.tsx            # Баҷи хўрду мирғалон
│       ├── tabs.tsx             # Вкладкаҳо
│       ├── select.tsx           # Рӯйхати интихобшаванда
│       ├── checkbox.tsx         # Қуттии интихоб
│       ├── radio-group.tsx      # Гурӯҳи радио
│       ├── label.tsx            # Сарлавҳаи майдон
│       ├── textarea.tsx         # Майдони матни дарозе
│       ├── toast.tsx            # Паёми муваққатӣ (Toast)
│       ├── tooltip.tsx          # Маслиҳати кӯтоҳ
│       ├── skeleton.tsx         # Loading skeleton
│       └── scroll-area.tsx      # Soҳаи ақбати прокрутка
│
├── lib/                         # Функсияҳо ва утилитаҳо
│   ├── supabase.ts             # Муштари Supabase
│   ├── query-client.ts         # Танзимоти React Query
│   ├── translations.ts         # Тарҷумаҳо (i18n)
│   ├── utils.ts                # Функсияҳои утилитаҳо
│   ├── image-utils.ts          # Функсияҳо барои коркарди суратҳо
│   ├── language-context.tsx    # Context барои идоракунии забон
│   ├── clerk-localization.ts   # Локализатсияи Clerk
│   ├── date-locales.ts         # Локализатсияи давомаҳо
│   ├── services/
│   │   ├── item-service.ts     # API барои кор бо эълонҳо
│   │   └── profile-service.ts  # API барои кор бо профилҳо
│   └── hooks/
│       └── use-items.ts        # Custom hook барои гирифтани эълонҳо
│
├── supabase/                   # Supabase functions & config
│   ├── config.toml            # Танзимоти Supabase ўстави
│   └── functions/
│       ├── clerk-sync/        # Function: Синхронизатсияи Clerk↔Supabase
│       │   ├── index.ts
│       │   └── deno.json
│       └── image-moderation/  # Function: Модератсияи суратҳо
│           ├── index.ts
│           └── deno.json
│
├── public/                     # Файлҳои статикӣ
│   └── (images, fonts, etc)
│
├── Configuration Files:
│   ├── package.json           # Dependencies ва scripts
│   ├── next.config.ts         # Танзимоти Next.js
│   ├── tsconfig.json          # Танзимоти TypeScript
│   ├── tailwind.config.js     # Танзимоти TailwindCSS
│   ├── eslint.config.mjs      # ESLint rules
│   ├── postcss.config.mjs     # PostCSS config
│   └── components.json        # UI компонентҳо
│
├── Database Files:
│   ├── schema.sql             # PostgreSQL шутур (tables, types)
│   └── rls_policies.sql       # Row Level Security аҳдот
│
└── Documentation:
    ├── README.md              # README фикрии аслӣ
    ├── CLAUDE.md              # Фикри таҳліл ва reverse engineering
    ├── AGENTS.md              # Agent 
    ├── clerk_integration.md   # Дастури Clerk ↔ Supabase
    ├── migration_plan.md      # Нақшаи миграция ва deployment
    ├── architecture_report.md # Ҳиссаи архитектура
    ├── JUYO.md (Comprehensive) # Ҳихӣ файли шумо!
    └── proxy.ts               # Proxy барои он ҷараҳо
```


## 🗄 Сохтори Базаи Маълумот

### Диаграмаи ER (Entity Relationship):

```
┌──────────────────────────────────────────────────────┐
│                 DATABASE SCHEMA                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────┐    ┌──────────────────┐   │
│  │    PROFILES         │    │    ITEMS         │   │
│  ├─────────────────────┤    ├──────────────────┤   │
│  │ id (TEXT) PK        │◄───│ user_id (FK)     │   │
│  │ first_name          │    │ id (UUID) PK     │   │
│  │ last_name           │    │ title            │   │
│  │ avatar_url          │    │ description      │   │
│  │ phone               │    │ category         │   │
│  │ secondary_phone     │    │ type (lost|found)│   │
│  │ created_at          │    │ date             │   │
│  │ updated_at          │    │ reward           │   │
│  │                     │    │ phone_number     │   │
│  │                     │    │ is_resolved      │   │
│  │                     │    │ moderation_status│   │
│  │                     │    │ created_at       │   │
│  └─────────────────────┘    └──────────────────┘
│           ▲                           │
│           └───────────────────────────┘
│                                        │
│  ┌──────────────────────────────┐    │
│  │    ITEM_IMAGES               │    │
│  ├──────────────────────────────┤    │
│  │ id (UUID) PK                 │    │
│  │ item_id (FK)◄────────────────┘
│  │ image_url                    │
│  │ created_at                   │
│  └──────────────────────────────┘
│
│  ┌──────────────────────────────┐
│  │    SAVED_ITEMS               │
│  ├──────────────────────────────┤
│  │ id (UUID) PK                 │
│  │ user_id (FK) → PROFILES      │
│  │ item_id (FK) → ITEMS         │
│  │ created_at                   │
│  └──────────────────────────────┘
│
└──────────────────────────────────────────────────────┘
```

### Таъриф Тафсилӣ ба Таблитсаҳо:

#### 1️⃣ **PROFILES** - Маълумоти Корбарон

```sql
┌─ id              : TEXT (PRIMARY KEY)        -- UID аз Clerk
├─ first_name      : TEXT                      -- Номи аввал
├─ last_name       : TEXT                      -- Номи охир
├─ avatar_url      : TEXT                      -- URL-и сурати корбар
├─ phone           : TEXT                      -- Номи телефон асосӣ
├─ secondary_phone : TEXT                      -- Номи телефон иловагӣ
├─ created_at      : TIMESTAMP DEFAULT NOW()   -- Мўҳлати сохт
└─ updated_at      : TIMESTAMP DEFAULT NOW()   -- Мўҳлати охирин тағйир
```

#### 2️⃣ **ITEMS** - Эълонҳо (Асосӣ)

```sql
┌─ id                   : UUID DEFAULT gen_random_uuid()
├─ user_id             : TEXT NOT NULL (FK → PROFILES.id)
├─ title               : TEXT NOT NULL         -- "Паспорти Қӯғонданӣ ..."
├─ description         : TEXT                  -- Тавсиф муфассал
├─ category            : TEXT NOT NULL         -- Electronics, Documents, Keys...
├─ type                : item_type (lost|found)-- enum type
├─ date                : DATE DEFAULT TODAY()  -- Тариҳи гумшуда/ёфтшуда
├─ reward              : TEXT                  -- Фоидаи гофта шуда
├─ phone_number        : TEXT                  -- Номи телефон ўстави
├─ is_resolved         : BOOLEAN DEFAULT FALSE -- Ҳалшудаест?
├─ views               : INTEGER DEFAULT 0     -- Шумораи дидҳо
├─ moderation_status   : moderation_status     -- pending|approved|rejected
├─ moderation_result   : TEXT                  -- Натиҷаи модератсия
├─ created_at          : TIMESTAMP DEFAULT NOW()
└─ updated_at          : TIMESTAMP DEFAULT NOW()
```

#### 3️⃣ **ITEM_IMAGES** - Суратҳои Эълон

```sql
┌─ id         : UUID DEFAULT gen_random_uuid()
├─ item_id   : UUID NOT NULL (FK → ITEMS.id)
├─ image_url : TEXT                           -- URL дар Supabase Storage
└─ created_at: TIMESTAMP DEFAULT NOW()
```

#### 4️⃣ **SAVED_ITEMS** - Эълонҳои Хаҳи Шудаа

```sql
┌─ id        : UUID DEFAULT gen_random_uuid()
├─ user_id  : TEXT NOT NULL (FK → PROFILES.id)
├─ item_id  : UUID NOT NULL (FK → ITEMS.id)
└─ created_at: TIMESTAMP DEFAULT NOW()
```

---

## 🔄 Ҷараёни Маълумот (Data Flow)

### 1️⃣ **Раванди Воридшавӣ (Sign In)**

```
User кликс "Sign In"
         ↓
┌─────────────────────────────┐
│ Clerk SignIn Modal Opens    │
│ (Google, Email)      │
└─────────────────────────────┘
         ↓
   User Authenticates
         ↓
┌─────────────────────────────────────┐
│ Clerk Issue JWT Token               │
│ (Sub: user.id)                      │
└─────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────┐
│ Clerk Edge Function Triggers                 │
│ Events: user.created   , UPDATE , DELATE     │
│ Webhook → Supabase                           │
│ /functions/clerk-sync                        │
└──────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────┐
│ Supabase Function (Deno)                 │
│ ├─ Verify Webhook Signature (Svix)       │
│ ├─ Extract user data from Clerk          │
│ │  (id, first_name, last_name, avatar)   │
│ └─ UPSERT into profiles table            │
└──────────────────────────────────────────┘
         ↓
   User Profile Created in Database
         ↓
  Next.js Client получает JWT token
         ↓
      User Logged In ✅
```

### 2️⃣ **Раванди Эълани Сабт (Add Item)**

```
User кликс "Add Lost/Found Item"
         ↓
┌──────────────────────────────┐
│ /app/(main)/items/add/page.tsx
│ - Fetch user profile         │
│ - Get pre-filled phone       │
└──────────────────────────────┘
         ↓
   User Fills Form:
   ├─ Title: "Паспорти Қӯғонданӣ"
   ├─ Category: "Documents"
   ├─ Type: "lost"
   ├─ Images: [file1.jpg, file2.jpg]
   └─ Phone: "+992-..."
         ↓
┌────────────────────────────────────┐
│ Client Compression                 │
│ (image-utils.ts)                   │
│ ├─ Compress images                 │
│ └─ Max: 800x600, 80% quality       │
└────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│ ItemService.createItem() Execution         │
│ Step 1: Upload images to Supabase Storage  │
│         /storage/v1/object/public/items/   │
│         Generate URLs for each image       │
└────────────────────────────────────────────┘
         ↓
┌───────────────────────────────────────────┐
│ Step 2: Insert into ITEMS table           │
│         ├─ moderation_status: "pending"   │
│         ├─ is_resolved: false             │
│         └─ user_id: from JWT              │
└───────────────────────────────────────────┘
         ↓
┌───────────────────────────────────────────┐
│ Step 3: Insert into ITEM_IMAGES table     │
│         (Link images to item)             │
└───────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│ Trigger Image Moderation (Optional)    │
│ POST /functions/v1/image-moderation    │
│ ├─ Analyze images with Sightengine     │
│ └─ Update moderation_status            │
└────────────────────────────────────────┘
         ↓
  Item Created ✅
  Show toast: "Эълон сабт шуд!"
  Redirect to /items/[id]
```

### 3️⃣ **Раванди Ҷустуҷӯ (Search)**

```
User Types "Паспорт" in Search Box
         ↓
┌──────────────────────────────────────┐
│ Debounce 300ms (utils)               │
│ Wait for user to stop typing         │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────┐
│ Update URL: /?q=Паспорт                      │
│ Router push with search params               │
└──────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│ useItems() Hook Triggered                        │
│ React Query calls ItemService.getItems()         │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────┐
│ Supabase Query Execution:                           │
│ SELECT * FROM items                                 │
│ WHERE title.ilike('%Паспорт%')                      │
│    OR description.ilike('%Паспорт%')               │
│    OR phone_number.ilike('%Паспорт%')              │
│ AND moderation_status = 'approved'                  │
│ AND is_resolved = false                            │
│ ORDER BY created_at DESC                           │
│ LIMIT 20                                           │
└──────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────┐
│ Results Cached (5 minutes)      │
│ React Query Cache               │
└─────────────────────────────────┘
         ↓
   Display Results in Frontend ✅
```

### 4️⃣ **Раванди Дида Шудан (View Item)**

```
User Clicks на Item Card
         ↓
┌─────────────────────────────┐
│ Navigate to /items/[id]     │
│ Pass item ID in URL         │
└─────────────────────────────┘
         ↓
┌───────────────────────────────────────┐
│ useItemDetails() Hook                 │
│ Fetch detailed item data              │
│ Include owner profile info            │
└───────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────┐
│ Supabase Query:                          │
│ SELECT *, profiles(*), item_images(*)    │
│ FROM items                               │
│ WHERE id = [item-uuid]                   │
│ AND (moderation_status = 'approved'      │
│      OR user_id = auth.uid)              │
└──────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ Update views counter:               │
│ items.views = views + 1             │
└─────────────────────────────────────┘
         ↓
   Display Item Details with Images ✅
   Show contact info (phone)
   Allow Save actions
```

---


## 🔗 Воҳидҳои Вебӣ Фоллаӣ

- **Clerk Docs:** https://clerk.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **React Query:** https://tanstack.com/query/latest

---

<!-- Ин шарҳ барои санҷиши git push илова карда шудааст. -->
<!-- Тағйироти охирин: 2026-06-01 -->


