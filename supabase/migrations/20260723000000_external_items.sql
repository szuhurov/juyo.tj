-- ============================================================================
-- Эълонҳои воридшуда аз манбаъҳои беруна (масалан Somon.tj) — на эълони
-- воқеии корбарони juyo.tj. Ҳар сабт метавонад ба ҷадвали умумии `items`
-- нашр карда шавад (published_item_id) — бе профили сохта, бе рақами
-- телефон (user_id = null, номи шахс танҳо дар матни унвон мемонад, ончи
-- дар худи somon.tj буд). Admin баъдтар аз саҳифаи "Аз манбаъҳои дигар"
-- рақами телефонро дастӣ илова мекунад — он ба эълони зиндаи published
-- низ худкор мегузарад.
-- ============================================================================

create table if not exists public.external_items (
  id                 uuid primary key default gen_random_uuid(),
  external_id        text not null,
  source             text not null default 'Somon.tj',
  title              text not null,
  description        text,
  images             text[] not null default '{}',
  category           text,
  type               text check (type in ('lost', 'found')),
  location            text,
  published_at       timestamptz,
  source_url         text not null,
  raw_data           jsonb,
  imported_at        timestamptz not null default now(),
  phone_number       text,
  published_item_id  uuid references public.items(id) on delete set null,
  unique (source, external_id)
);

create index if not exists idx_external_items_source on public.external_items(source, imported_at desc);

-- Танҳо тавассути service-role (admin API/скриптҳо) — RLS фаъол, бе policy = deny барои anon/authenticated.
alter table public.external_items enable row level security;
