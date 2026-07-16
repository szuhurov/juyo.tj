-- ============================================================================
-- Васеъ кардани external_items барои дастгирии манбаи дуюм — каналҳои
-- Telegram (илова бар somon.tj). source_channel ном/username-и каналро
-- нигоҳ медорад (масалан "poteryashki_tj"), telegram_message_id ID-и
-- паёми аслӣ, ai_confidence дараҷаи боварии таснифи AI.
--
-- Маҳдудияти unique(source, external_id) кофӣ набуд: паёми №100 дар ду
-- канали ГУНОГУН ҳарду метавонанд вуҷуд дошта бошанд (ID-ҳо аз рӯи ҳар
-- канал алоҳида мешуморанд) — акнун source_channel низ ба калиди
-- беназир илова мешавад.
-- ============================================================================

-- source_channel bo NOT NULL default '' (на NULL) — то дар Postgres
-- unique constraint дуруст кор кунад (NULL ҳаргиз бо NULL-и дигар
-- баробар ҳисоб намешавад, пас якто холигӣ барои ҳамаи манбаъҳои
-- бе-канал, масалан somon.tj, лозим аст).
alter table public.external_items add column if not exists source_channel text not null default '';
alter table public.external_items add column if not exists telegram_message_id bigint;
alter table public.external_items add column if not exists ai_confidence numeric;

alter table public.external_items drop constraint if exists external_items_source_external_id_key;
alter table public.external_items
  add constraint external_items_source_channel_external_id_key unique (source, source_channel, external_id);

create index if not exists idx_external_items_source_channel on public.external_items(source_channel);
