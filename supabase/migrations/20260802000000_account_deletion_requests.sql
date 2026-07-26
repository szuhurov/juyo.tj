-- Google Play Data Safety policy (аз дек 2023) талаб мекунад, ки корбарон
-- бояд тавонанд нест кардани маълумоти худро тавассути ВЕБ дархост кунанд,
-- бе лозим будани воридшавӣ/насб кардани барнома (масалан, агар шифр гум
-- шуда бошад ё телефон дигар дастрас набошад). Ин ҷадвал он дархостҳоро
-- сабт мекунад, то admin онҳоро аз саҳифаи /admin коркард кунад.
create table if not exists public.account_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  note         text,
  status       text not null default 'pending' check (status in ('pending', 'processed', 'rejected')),
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists idx_account_deletion_requests_status on public.account_deletion_requests(status, created_at desc);
alter table public.account_deletion_requests enable row level security;
-- Бе policy = ҳама дархост deny — навиштан танҳо тавассути API-и public
-- (service role), хондан/коркард танҳо тавассути admin API (service role).
