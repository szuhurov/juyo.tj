-- Танзимоти глобалии барнома (як сабт танҳо) — ҳозир танҳо
-- ai_moderation_enabled: агар admin онро хомӯш кунад (масалан токени
-- OpenAI тамом шуда бошад), эълонҳои нав бе санҷиши AI бо
-- moderation_status='pending' нашр мешаванд (танҳо дар профили худи
-- корбар намоён, на дар лентаи умумӣ — ниг. search_items RPC), то admin
-- баъдтар дастӣ тафтиш ва тасдиқ кунад.
create table if not exists public.app_settings (
  id boolean primary key default true,
  ai_moderation_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint app_settings_single_row check (id)
);

insert into public.app_settings (id, ai_moderation_enabled)
values (true, true)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists app_settings_public_read on public.app_settings;
create policy app_settings_public_read
  on public.app_settings for select
  using (true);
