-- Ихтиёрҳои иловагии тамос барои эълон: агар корбар ҳангоми сохтан/таҳрир
-- кардани эълон қутиро фаъол кунад, дар саҳифаи ашё тугмаи Telegram/WhatsApp
-- (аз рӯи ҳамон рақами телефони эълон) дар паҳлӯи «Занг задан» пайдо мешавад.
alter table public.items
  add column if not exists contact_telegram boolean not null default false,
  add column if not exists contact_whatsapp boolean not null default false;
