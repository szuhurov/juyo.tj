-- ============================================================================
-- Search v2 regression tests (pgTAP) for public.search_items and its helpers.
-- Run with:  supabase test db   (needs the pgTAP extension; local stack)
--
-- Fixtures are created INSIDE the test transaction and rolled back, and every
-- fixture item carries the category 'ZZSRCHFX' — every search below is
-- filtered to that category, so the result does not depend on production data
-- and never touches it. The vocabulary is taken from real JUYO listings:
-- ҳуҷҷат, шиноснома, калид/калит, телефон, самсунг, айфон, ҳамён, ҷӯроб, ...
--
-- Roles: results for anon / authenticated are COLLECTED under `set local role`
-- into a temp table and asserted afterwards as the test owner.
-- ============================================================================
begin;
select plan(77);

-- ---------- fixtures ---------------------------------------------------------
insert into public.profiles (id) values ('zz_search_user_a'), ('zz_search_user_b'), ('zz_search_user_c')
on conflict (id) do nothing;

create or replace function pg_temp.fx(
  p_title text, p_descr text default null, p_date date default current_date,
  p_type item_type default 'lost', p_city text default 'dushanbe', p_owner text default 'zz_search_user_a',
  p_mod moderation_status default 'approved', p_resolved boolean default false, p_status text default null,
  p_created timestamptz default now()
) returns uuid language sql as $$
  insert into public.items (id, user_id, title, description, category, type, date, moderation_status, is_resolved, city, status, created_at)
  values (gen_random_uuid(), p_owner, p_title, p_descr, 'ZZSRCHFX', p_type, p_date, p_mod, p_resolved, p_city, p_status, p_created)
  returning id;
$$;

select pg_temp.fx('ҳуҷҷат',        'фикстура');
select pg_temp.fx('Ҳуҷҷатҳо',      'фикстура множ');
select pg_temp.fx('Телефон',       'Samsung galaxy A15');
select pg_temp.fx('Самсунг',       'ещё один телефон');
select pg_temp.fx('Айфон',         'айфон 15 про');
select pg_temp.fx('Калид',         'ключи от дома');
select pg_temp.fx('Ключи',         'связка ключей');
select pg_temp.fx('Ҷӯроб',         'носки');
select pg_temp.fx('Шиноснома',     'паспорт');
select pg_temp.fx('Ҳамён',         'кошелёк');
select pg_temp.fx('Қалам',         'ручка');
select pg_temp.fx('Калам',         'другое слово');
select pg_temp.fx('Замок пятый',   'не связано');
select pg_temp.fx('Ноутбук',       'титульный');
select pg_temp.fx('Сумка',         'внутри ноутбук и документы');
select pg_temp.fx('Телефон',       'город хуҷанд', current_date, 'lost',  'khujand');
select pg_temp.fx('Телефон',       'найден',       current_date, 'found', 'dushanbe');
-- hidden variants (visibility)
select pg_temp.fx('Скрытый ҳуҷҷат pending',  null, current_date, 'lost', 'dushanbe', 'zz_search_user_b', 'pending');
select pg_temp.fx('Скрытый ҳуҷҷат resolved', null, current_date, 'lost', 'dushanbe', 'zz_search_user_b', 'approved', true);
select pg_temp.fx('Скрытый ҳуҷҷат deleted',  null, current_date, 'lost', 'dushanbe', 'zz_search_user_b', 'approved', false, 'deleted');
select pg_temp.fx('Скрытый ҳуҷҷат public',   null, current_date, 'lost', 'dushanbe', 'zz_search_user_b', 'approved');
-- pagination set
select pg_temp.fx('Пагинация тест', 'p' || g, current_date - g) from generate_series(1, 30) g;
-- VIP tie-break: same title, same day, owners A (fresher) and C (1h older, boosted)
select pg_temp.fx('Випслово',  'fresh',  current_date, 'lost', 'dushanbe', 'zz_search_user_a', 'approved', false, null, now());
select pg_temp.fx('Випслово',  'boosted', current_date, 'lost', 'dushanbe', 'zz_search_user_c', 'approved', false, null, now() - interval '1 hour');
-- boosted owner also has a DESCRIPTION-ONLY match that must NOT beat a real title match
select pg_temp.fx('Простой заголовок', 'тут есть слово квазизвезда', current_date, 'lost', 'dushanbe', 'zz_search_user_c');
select pg_temp.fx('Квазизвезда',       'настоящий заголовок',        current_date - 5, 'lost', 'dushanbe', 'zz_search_user_a');

create temp table _s (label text, id uuid, title text, rn int);
create or replace function pg_temp.s(p_label text, p_search text default null, p_limit int default 200, p_offset int default 0,
                                     p_type text default null, p_city text default null, p_user text default null)
returns void language sql as $$
  insert into _s
  select p_label, r.id, r.title, row_number() over ()
  from public.search_items(p_search => p_search, p_category => 'ZZSRCHFX', p_type => p_type, p_city => p_city,
                           p_user_id => p_user, p_limit => p_limit, p_offset => p_offset) r;
$$;
create or replace function pg_temp.top(p_label text) returns text language sql as $$
  select title from _s where label = p_label and rn = 1;
$$;
create or replace function pg_temp.has(p_label text, p_title text) returns boolean language sql as $$
  select exists (select 1 from _s where label = p_label and title = p_title);
$$;
create or replace function pg_temp.n(p_label text) returns bigint language sql as $$
  select count(*) from _s where label = p_label;
$$;
create or replace function pg_temp.rank_of(p_label text, p_title text) returns int language sql as $$
  select min(rn) from _s where label = p_label and title = p_title;
$$;

-- ---------- collect --------------------------------------------------------
select pg_temp.s('exact', 'телефон');
select pg_temp.s('prefix', 'тел');
select pg_temp.s('upper', 'ТЕЛЕФОН');
select pg_temp.s('spaces', '   телефон   ');
select pg_temp.s('typo1', 'телефонн');
select pg_temp.s('typo2', 'телфон');
select pg_temp.s('tj_exact', 'ҳуҷҷат');
select pg_temp.s('tj_prefix', 'ҳуҷ');
select pg_temp.s('tj_plural', 'ҳуҷҷатҳо');
select pg_temp.s('tj_typo_ru_keys', 'хуччат');
select pg_temp.s('tj_typo_ru_keys2', 'хучат');
select pg_temp.s('tj_latin', 'hujjat');
select pg_temp.s('tj_upper', 'ҲУҶҶАТ');
select pg_temp.s('kalid_latin', 'kalid');
select pg_temp.s('telefon_latin', 'telefon');
select pg_temp.s('jurob_latin', 'jurob');
select pg_temp.s('hamyon_latin', 'hamyon');
select pg_temp.s('qalam_tj', 'қалам');
select pg_temp.s('qalam_ru', 'калам');
select pg_temp.s('mixed_tj_ru', 'ҳуҷҷат телефон');
select pg_temp.s('mixed_en_ru', 'Samsung телефон');
select pg_temp.s('iphone', 'iphone');
select pg_temp.s('iphone_upper', 'IPHONE');
select pg_temp.s('i_phone', 'i phone');
select pg_temp.s('i_hyphen_phone', 'i-phone');
select pg_temp.s('iphone_15', 'iphone 15');
select pg_temp.s('iphone_15_pro', 'iphone 15 pro');
select pg_temp.s('iph', 'iph');
select pg_temp.s('iphon', 'iphon');
select pg_temp.s('iphnoe', 'iphnoe');
select pg_temp.s('ipone', 'ipone');
select pg_temp.s('samsung', 'samsung');
select pg_temp.s('passport', 'passport');
select pg_temp.s('paspot_ru', 'паспорт');
select pg_temp.s('none', 'zzqxnonexistentword');
select pg_temp.s('short_t', 'т');
select pg_temp.s('blank', '   ');
select pg_temp.s('browse', null);
select pg_temp.s('city_khujand', 'телефон', 200, 0, null, 'khujand');
select pg_temp.s('type_found', 'телефон', 200, 0, 'found');
select pg_temp.s('type_found_city_dushanbe', 'телефон', 200, 0, 'found', 'dushanbe');
select pg_temp.s('page_big', 'пагинация', 21, 0);
select pg_temp.s('page_1', 'пагинация', 7, 0);
select pg_temp.s('page_2', 'пагинация', 7, 7);
select pg_temp.s('page_3', 'пагинация', 7, 14);
select pg_temp.s('all_pages', 'пагинация', 200, 0);
select pg_temp.s('ranking_title_vs_body', 'ноутбук');
select pg_temp.s('vip_before', 'випслово');
select pg_temp.s('quasi', 'квазизвезда');
select pg_temp.s('escaped', 'i\_phone');

-- visibility, collected under real roles
create temp table _vis (who text, scenario text, n bigint, titles text);
grant all on _vis to anon, authenticated;
set local role anon;
insert into _vis select 'anon', 'feed', count(*), string_agg(title, '|' order by title) from public.search_items(p_search => 'скрытый', p_category => 'ZZSRCHFX', p_limit => 50);
insert into _vis select 'anon', 'p_user_id=B', count(*), string_agg(title, '|' order by title) from public.search_items(p_user_id => 'zz_search_user_b', p_category => 'ZZSRCHFX', p_limit => 50) where title like 'Скрытый%';
insert into _vis select 'anon', 'limit_cap', count(*), null from public.search_items(p_limit => 100000);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'zz_search_user_a', 'role', 'authenticated')::text, true);
insert into _vis select 'A', 'p_user_id=B', count(*), string_agg(title, '|' order by title) from public.search_items(p_user_id => 'zz_search_user_b', p_category => 'ZZSRCHFX', p_limit => 50) where title like 'Скрытый%';
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'zz_search_user_b', 'role', 'authenticated')::text, true);
insert into _vis select 'B(owner)', 'p_user_id=B', count(*), string_agg(title, '|' order by title) from public.search_items(p_user_id => 'zz_search_user_b', p_category => 'ZZSRCHFX', p_limit => 50) where title like 'Скрытый%';
reset role;

-- VIP boost: give C's fixture owner an active VIP, search again
insert into public.subscriptions (user_id, plan_id, tier, duration_days, price_tjs, status, starts_at, expires_at)
select 'zz_search_user_c', (select id from public.vip_plans where tier = 'vip' and duration_days = 5), 'vip', 5, 25, 'active', now(), now() + interval '5 days';
select pg_temp.s('vip_after', 'випслово');
select pg_temp.s('quasi_vip', 'квазизвезда');

-- ---------- assertions -----------------------------------------------------
-- exact / prefix / case / spaces / typo
select is(pg_temp.top('exact'), 'Телефон', 'exact: "телефон" ranks the title "Телефон" first');
select ok(pg_temp.has('prefix', 'Телефон'), 'prefix: "тел" finds Телефон');
select is(pg_temp.top('upper'), pg_temp.top('exact'), 'case: "ТЕЛЕФОН" behaves like "телефон"');
select is(pg_temp.n('spaces'), pg_temp.n('exact'), 'spaces: surrounding whitespace is ignored');
select ok(pg_temp.has('typo1', 'Телефон'), 'typo: "телефонн" (extra letter) finds Телефон');
select ok(pg_temp.has('typo2', 'Телефон'), 'typo: "телфон" (missing letter) finds Телефон');

-- Tajik
select is(pg_temp.top('tj_exact'), 'ҳуҷҷат', 'tajik: exact "ҳуҷҷат" ranks the exact title first');
select ok(pg_temp.has('tj_prefix', 'ҳуҷҷат') and pg_temp.has('tj_prefix', 'Ҳуҷҷатҳо'), 'tajik prefix: "ҳуҷ" finds both ҳуҷҷат and Ҳуҷҷатҳо');
select is(pg_temp.top('tj_plural'), 'Ҳуҷҷатҳо', 'tajik plural: "ҳуҷҷатҳо" ranks Ҳуҷҷатҳо first');
select ok(pg_temp.has('tj_plural', 'ҳуҷҷат'), 'tajik plural: "ҳуҷҷатҳо" also reaches the singular ҳуҷҷат');
select ok(pg_temp.has('tj_typo_ru_keys', 'ҳуҷҷат'), 'tajik typo: Russian-keyboard "хуччат" finds ҳуҷҷат');
select is(pg_temp.top('tj_typo_ru_keys'), 'ҳуҷҷат', 'tajik typo: "хуччат" ranks the exact-fold ҳуҷҷат first');
select ok(pg_temp.has('tj_typo_ru_keys2', 'ҳуҷҷат'), 'tajik typo: "хучат" finds ҳуҷҷат');
select ok(pg_temp.has('tj_latin', 'ҳуҷҷат'), 'tajik latin: "hujjat" finds ҳуҷҷат');
select ok(pg_temp.has('tj_upper', 'ҳуҷҷат'), 'tajik upper: "ҲУҶҶАТ" finds ҳуҷҷат');
select is(pg_temp.top('kalid_latin'), 'Калид', 'tajik latin: "kalid" ranks Калид first');
select is(pg_temp.top('telefon_latin'), 'Телефон', 'latin: "telefon" ranks Телефон first');
select ok(pg_temp.has('jurob_latin', 'Ҷӯроб'), 'tajik latin: "jurob" finds Ҷӯроб (ҷ, ӯ)');
select ok(pg_temp.has('hamyon_latin', 'Ҳамён'), 'tajik latin: "hamyon" finds Ҳамён');
-- қ != к : the exact-letter title always outranks the folded look-alike, both ways
select is(pg_temp.top('qalam_tj'), 'Қалам', 'tajik precision: "қалам" ranks Қалам above Калам');
select ok(pg_temp.has('qalam_tj', 'Калам'), 'tajik tolerance: "қалам" still reaches the look-alike Калам');
select is(pg_temp.top('qalam_ru'), 'Калам', 'tajik precision: "калам" ranks Калам above Қалам');
select ok(pg_temp.has('qalam_ru', 'Қалам'), 'tajik tolerance: "калам" still reaches Қалам');
select ok(pg_temp.rank_of('qalam_tj', 'Қалам') < pg_temp.rank_of('qalam_tj', 'Калам'), 'tajik precision: exact-letter rank is strictly better than folded rank');

-- mixed languages
select ok(pg_temp.n('mixed_tj_ru') > 0, 'mixed tj+ru: "ҳуҷҷат телефон" returns results (relaxation)');
select ok(pg_temp.has('mixed_en_ru', 'Телефон'), 'mixed en+ru: "Samsung телефон" finds the Телефон item mentioning Samsung');

-- English / brands / synonyms
select is(pg_temp.top('iphone'), 'Айфон', 'english: "iphone" ranks Айфон first');
select is(pg_temp.top('iphone_upper'), 'Айфон', 'english: "IPHONE" ranks Айфон first');
select is(pg_temp.top('i_phone'), 'Айфон', 'spacing: "i phone" ranks Айфон first');
select is(pg_temp.top('i_hyphen_phone'), 'Айфон', 'hyphen: "i-phone" ranks Айфон first');
select is(pg_temp.top('iphone_15'), 'Айфон', 'multi-word: "iphone 15" still ranks Айфон first');
select is(pg_temp.top('iphone_15_pro'), 'Айфон', 'multi-word: "iphone 15 pro" ranks Айфон first');
select is(pg_temp.top('iph'), 'Айфон', 'live typing: "iph" finds Айфон');
select is(pg_temp.top('iphon'), 'Айфон', 'live typing: "iphon" finds Айфон');
select is(pg_temp.top('iphnoe'), 'Айфон', 'typo (transposition): "iphnoe" finds Айфон');
select is(pg_temp.top('ipone'), 'Айфон', 'typo: "ipone" finds Айфон');
select is(pg_temp.top('escaped'), 'Айфон', 'client escaping: "i\_phone" (as the apps send it) behaves like "i phone"');
select ok(pg_temp.rank_of('samsung', 'Самсунг') < pg_temp.rank_of('samsung', 'Телефон'), 'ranking: title "Самсунг" outranks a listing that only mentions Samsung in its description');
select ok(pg_temp.has('passport', 'Шиноснома'), 'synonym: "passport" finds Шиноснома');
select ok(pg_temp.has('paspot_ru', 'Шиноснома'), 'synonym: "паспорт" finds Шиноснома');
select ok(not pg_temp.has('iphone', 'Телефон'), 'precision: "iphone" does not drift into the generic phone group');

-- no result / short / blank
select is(pg_temp.n('none'), 0::bigint, 'no result: a nonsense word returns nothing');
select ok(not pg_temp.has('short_t', 'Замок пятый'), 'short query: "т" does not match a "т" buried inside a word');
select ok(pg_temp.has('short_t', 'Телефон'), 'short query: "т" still matches words that START with т');
select is(pg_temp.n('blank'), pg_temp.n('browse'), 'blank: whitespace-only input behaves like no search');

-- filters combine
select ok(pg_temp.n('city_khujand') >= 1 and not exists (select 1 from _s s join public.items i on i.id = s.id where s.label = 'city_khujand' and i.city <> 'khujand'), 'filter: search + city returns only that city');
select ok(pg_temp.n('type_found') >= 1 and not exists (select 1 from _s s join public.items i on i.id = s.id where s.label = 'type_found' and i.type <> 'found'), 'filter: search + type returns only that type');
select ok(pg_temp.n('type_found_city_dushanbe') >= 1 and not exists (select 1 from _s s join public.items i on i.id = s.id where s.label = 'type_found_city_dushanbe' and (i.type <> 'found' or i.city <> 'dushanbe')), 'filter: search + type + city all apply together');
select ok(pg_temp.n('city_khujand') < pg_temp.n('exact'), 'filter: adding a city narrows the result set');

-- pagination
select is((select string_agg(id::text, ',' order by rn) from _s where label = 'page_big'),
          (select string_agg(id::text, ',' order by lbl, rn) from (select id, rn, case label when 'page_1' then 1 when 'page_2' then 2 else 3 end lbl from _s where label in ('page_1', 'page_2', 'page_3')) z),
          'pagination: three pages of 7 equal the first 21 of one big page (stable order, no gaps)');
select is((select count(*) - count(distinct id) from _s where label = 'all_pages'), 0::bigint, 'pagination: no duplicated rows');
select is(pg_temp.n('all_pages'), 30::bigint, 'pagination: all 30 fixtures are reachable');

-- ranking
select is(pg_temp.top('ranking_title_vs_body'), 'Ноутбук', 'ranking: a title match beats a description-only match');

-- VIP boost: only a tie-breaker
select is(pg_temp.top('vip_before'), 'Випслово', 'vip: baseline returns the fixtures');
select is((select description from public.items where id = (select id from _s where label = 'vip_before' and rn = 1)), 'fresh', 'vip: before boost the fresher listing is first');
select is((select description from public.items where id = (select id from _s where label = 'vip_after' and rn = 1)), 'boosted', 'vip: after boost the older same-day listing of the VIP owner wins the tie');
select is((select title from _s where label = 'quasi_vip' and rn = 1), 'Квазизвезда', 'vip: a boosted DESCRIPTION-only match never outranks a real title match');

-- visibility / security
select is((select n from _vis where who = 'anon' and scenario = 'feed'), 1::bigint, 'security: anon feed search sees only the approved, unresolved, non-deleted listing');
select is((select titles from _vis where who = 'anon' and scenario = 'feed'), 'Скрытый ҳуҷҷат public', 'security: anon sees no pending / resolved / deleted listing');
select is((select titles from _vis where who = 'anon' and scenario = 'p_user_id=B'), 'Скрытый ҳуҷҷат public', 'security: p_user_id of another user exposes no pending/rejected listing to anon');
select is((select titles from _vis where who = 'A' and scenario = 'p_user_id=B'), 'Скрытый ҳуҷҷат public', 'security: p_user_id of another user exposes no pending/rejected listing to a signed-in stranger');
select ok((select titles from _vis where who = 'B(owner)') like '%pending%' and (select titles from _vis where who = 'B(owner)') not like '%deleted%', 'security: the owner sees own pending listing but never a soft-deleted one');
select ok((select n from _vis where who = 'anon' and scenario = 'limit_cap') <= 200, 'safety: p_limit is capped at 200');

-- robustness: nothing may raise
select lives_ok($$select count(*) from public.search_items(p_search => 'it''s')$$, 'robust: apostrophe');
select lives_ok($$select count(*) from public.search_items(p_search => 'a & b | !c (d) <-> e:*')$$, 'robust: tsquery operators');
select lives_ok($$select count(*) from public.search_items(p_search => ':*')$$, 'robust: lone :*');
select lives_ok($$select count(*) from public.search_items(p_search => '''; drop table public.items; --')$$, 'robust: sql metacharacters');
select lives_ok($$select count(*) from public.search_items(p_search => 'http://juyo.tj/a?b=1')$$, 'robust: url');
select lives_ok($$select count(*) from public.search_items(p_search => 'user@example.com')$$, 'robust: e-mail');
select lives_ok($$select count(*) from public.search_items(p_search => repeat('телефон ', 200))$$, 'robust: 1600-char query');
select lives_ok($$select count(*) from public.search_items(p_search => E'\\')$$, 'robust: lone backslash');
select lives_ok($$select count(*) from public.search_items(p_search => '📱 телефон')$$, 'robust: emoji');
select lives_ok($$select count(*) from public.search_items(p_search => '%')$$, 'robust: percent');
select is((select count(*) from public.items where title = 'Замок пятый' and category = 'ZZSRCHFX'), 1::bigint, 'robust: the sql-injection attempt did not drop or alter the table');

-- fold / synonym unit checks
select is(public.search_fold('Ҳуҷҷат'), public.search_fold('hujjat'), 'fold: Ҳуҷҷат == hujjat');
select is(public.search_fold('Ҳуҷҷат'), 'хучат', 'fold: Ҳуҷҷат -> хучат');
select isnt(public.search_fold('қалам'), public.search_fold('ҳалам'), 'fold: distinct Tajik letters still yield distinct words');

select * from finish();
rollback;
