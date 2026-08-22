-- Индексҳо барои навори оммавии `search_items`.
--
-- САБАБ. `EXPLAIN (ANALYZE)` барои даъвати муқаррарии саҳифаи асосӣ
--   search_items(p_type := 'found', p_limit := 20, p_offset := 0)
-- чунин нақша дод:
--
--   Sort  (Sort Key: i.date DESC, i.created_at DESC, i.id)
--     ->  Seq Scan on items i
--           Filter: ((NOT is_resolved) OR (is_resolved IS NULL))
--                   AND ((status IS NULL) OR (status <> 'deleted'))
--                   AND (moderation_status = 'approved')
--                   AND (type = 'found')
--
-- Яъне ҲАР кушодани саҳифаи асосӣ тамоми ҷадвали `items`-ро мехонад ва
-- баъд мураттаб мекунад. Ҳозир ин 0.5мс аст, чунки ҳамагӣ ~106 сатр ҳаст —
-- вале вақти иҷро бо шумораи сатрҳо хатти рост боло меравад. Дар 100k+
-- эълон ин сонияҳо мешавад ва саҳифаи асосӣ «ях мезанад».
--
-- Индексҳои мавҷуда ин ҷо кӯмак намекунанд:
--   * `idx_items_type`, `idx_items_category` — танҳо як сутун, тартиби
--     `date DESC` дар онҳо нест, пас Sort ба ҳар ҳол мемонад;
--   * `idx_items_moderation_created` = (moderation_status, created_at DESC) —
--     тартиби воқеӣ бо `date DESC` ОҒОЗ мешавад, на бо `created_at`.
--
-- ҲАЛЛ. Индекси ҚИСМӢ (partial) бо ШАРТИ АЙНАН ҳамон филтри доимии
-- функсия, ва бо тартиби АЙНАН ҳамон `order by`. Он гоҳ Postgres ҳам
-- филтр ҳам мураттабсозиро аз худи индекс мегирад — Seq Scan ва Sort
-- ҳарду нест мешаванд.
--
-- Шарт СУХАН БА СУХАН аз `search_items` гирифта шудааст. Агар он ҷо
-- шарт иваз шавад, ин ҷо низ бояд иваз шавад — вагарна планировщик
-- мутобиқатро исбот карда наметавонад ва индекс бекор мемонад.

-- 1) Навори умумӣ — вақте филтри навъ ва категория нест.
create index if not exists items_public_feed_idx
  on public.items (date desc, created_at desc, id)
  where moderation_status = 'approved'
    and (status is null or status <> 'deleted')
    and (is_resolved = false or is_resolved is null);

-- 2) Роҳи ГАРМТАРИН: барнома ва сайт ҳамеша навъ мефиристанд —
--    пешфарз «found». Ҳамин индекс дар амал бештар кор мекунад.
create index if not exists items_public_feed_type_idx
  on public.items (type, date desc, created_at desc, id)
  where moderation_status = 'approved'
    and (status is null or status <> 'deleted')
    and (is_resolved = false or is_resolved is null);

-- 3) Филтри категория (Электроника, Ҳуҷҷатҳо, …).
create index if not exists items_public_feed_category_idx
  on public.items (category, date desc, created_at desc, id)
  where moderation_status = 'approved'
    and (status is null or status <> 'deleted')
    and (is_resolved = false or is_resolved is null);

-- 4) Тугмаҳои амали зуд (такси, фурудгоҳ, …).
create index if not exists items_public_feed_location_idx
  on public.items (location_type, date desc, created_at desc, id)
  where moderation_status = 'approved'
    and (status is null or status <> 'deleted')
    and (is_resolved = false or is_resolved is null)
    and location_type is not null;

-- 5) «Эълонҳои ман» — шохаи дигари функсия (p_user_id is not null).
create index if not exists items_user_feed_idx
  on public.items (user_id, date desc, created_at desc, id)
  where status is null or status <> 'deleted';


-- ЁДДОШТ 1 — RLS. Ин танҳо индександ; ҳеҷ сиёсат, ҳеҷ дастрасӣ иваз
-- намешавад. Худи `search_items` низ даст нахӯрд.
--
-- ЁДДОШТ 2 — `concurrently` гузошта нашуд. Supabase миграцияро дар як
-- транзаксия иҷро мекунад ва `create index concurrently` дар транзаксия
-- кор намекунад. Дар ҳаҷми ҳозира (~106 сатр) индекс дар як лаҳза сохта
-- мешавад ва қулф ҳис намешавад. АГАР ҷадвал аллакай калон бошад, ин
-- фармонҳоро ҷудогона, берун аз миграция, бо `concurrently` иҷро кунед.
--
-- ЁДДОШТ 3 — ин `offset`-ро ислоҳ намекунад. `offset 20000` ба ҳар ҳол
-- 20000 сатрро мехонаду мепартояд. То саҳифаи ~50 ин ҳис намешавад;
-- барои амиқтар рафтан keyset pagination лозим мешавад
-- (`where (date, created_at, id) < (охирини саҳифаи қаблӣ)`), ки ин
-- тағйири худи функсия ва ҳарду мизоҷ аст — алоҳида бояд ҳал шавад.
