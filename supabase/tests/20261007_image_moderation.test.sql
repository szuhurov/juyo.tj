-- Integration test for 20261007010000_image_moderation.sql (needs
-- 20261007000000_visual_search.sql). Runs inside a transaction and ROLLS BACK:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/20261007_image_moderation.test.sql
-- Uses a synthetic test model (one-hot weights) so the expected decisions are
-- exact; the real model's weights come from Web/tools/moderation-bench.
-- Every row of the final result must read 'ok'.
begin;
-- scratch objects live in a throwaway schema (rolled back with everything else)
-- so the 'authenticated' role can use them too
create schema modtest;
create table modtest.u as select id from profiles order by id limit 2;
create table modtest.r(k text, v text);
create table modtest.t(k text primary key, v text);
grant usage on schema modtest to authenticated;
grant all on all tables in schema modtest to authenticated;

-- unit vectors in 384-d: e(i), or a·e(i) + sqrt(1-a²)·e(j)
create function modtest.vec(i int, a real default 1, j int default null) returns real[] language sql as $$
  select array_agg(case when g = i then a when g = j then sqrt(1 - a * a)::real else 0 end order by g) from generate_series(1, 384) g $$;

select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
update moderation_models set active = false where active;
insert into moderation_models (id, visual_model_id, head_sha256, policy_version, active)
values ('test-model', 'dinov2-s14-q4.r280-area-v1', repeat('a', 64), 'test', true);
-- firearm fires on dimension 1, blade on dimension 2: p = sigmoid(20·x − 10)
insert into moderation_heads (model_id, category, weights, bias, t_review, t_block) values
  ('test-model', 'firearm', modtest.vec(1, 20)::vector, -10, 0.5, 0.99),
  ('test-model', 'blade', modtest.vec(2, 20)::vector, -10, 0.5, 0.99);

-- four pending listings of user 1, one photo each
insert into items (id, user_id, title, description, category, type, city, date) values
  ('00000000-0000-0000-0000-0000000c0001', (select id from modtest.u limit 1), 'A', 'gun', 'Bag', 'lost', 'dushanbe', current_date),
  ('00000000-0000-0000-0000-0000000c0002', (select id from modtest.u limit 1), 'B', 'wallet', 'Wallet', 'lost', 'dushanbe', current_date),
  ('00000000-0000-0000-0000-0000000c0003', (select id from modtest.u limit 1), 'C', 'passport', 'Documents', 'found', 'dushanbe', current_date),
  ('00000000-0000-0000-0000-0000000c0004', (select id from modtest.u limit 1), 'D', 'maybe knife', 'Other', 'found', 'dushanbe', current_date);
update items set moderation_status = 'pending' where id::text like '00000000-0000-0000-0000-0000000c000%';
insert into item_images (id, item_id, image_url) values
  ('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-0000000c0001', 'https://x/a.jpg'),
  ('00000000-0000-0000-0000-0000000d0002', '00000000-0000-0000-0000-0000000c0002', 'https://x/b.jpg'),
  ('00000000-0000-0000-0000-0000000d0003', '00000000-0000-0000-0000-0000000c0003', 'https://x/c.jpg'),
  ('00000000-0000-0000-0000-0000000d0004', '00000000-0000-0000-0000-0000000c0004', 'https://x/d.jpg');

-- the poster's device sends vectors (as user 1, with the client's database role)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', (select id from modtest.u limit 1))::text, true);
select set_image_embedding('00000000-0000-0000-0000-0000000d0001', 'dinov2-s14-q4.r280-area-v1', modtest.vec(1), null);
select set_image_embedding('00000000-0000-0000-0000-0000000d0002', 'dinov2-s14-q4.r280-area-v1', modtest.vec(3), null);
select set_image_embedding('00000000-0000-0000-0000-0000000d0003', 'dinov2-s14-q4.r280-area-v1', modtest.vec(3), null);
select set_image_embedding('00000000-0000-0000-0000-0000000d0004', 'dinov2-s14-q4.r280-area-v1', modtest.vec(2, 0.55, 4), null);

-- the poster cannot read moderation data nor call the admin functions
do $$ begin
  perform 1 from image_moderation limit 1;
  insert into modtest.r values ('user_cannot_read_moderation', 'FAIL: readable');
exception when insufficient_privilege then insert into modtest.r values ('user_cannot_read_moderation', 'ok'); end $$;
do $$ begin
  perform admin_bulk_approve('[]'::jsonb, 'x');
  insert into modtest.r values ('user_cannot_bulk_approve', 'FAIL: callable');
exception when insufficient_privilege then insert into modtest.r values ('user_cannot_bulk_approve', 'ok'); end $$;
-- the poster cannot approve their own listing by hand either
do $$ begin
  update items set moderation_status = 'approved' where id = '00000000-0000-0000-0000-0000000c0002';
exception when insufficient_privilege then null; end $$;

reset role;
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
insert into modtest.r select 'user_self_approve_ignored', case when moderation_status = 'pending' then 'ok' else 'FAIL: ' || moderation_status end from items where id = '00000000-0000-0000-0000-0000000c0002';
-- A: firearm, very high confidence → BLOCK → rejected with the key the apps translate
insert into modtest.r select 'A_block', case when decision = 'block' and reasons = '{firearm}' and source = 'author' then 'ok' else 'FAIL: ' || decision || ' ' || reasons::text end from image_moderation where image_id = '00000000-0000-0000-0000-0000000d0001';
insert into modtest.r select 'A_rejected', case when moderation_status = 'rejected' and moderation_result = 'mod_weapon' then 'ok' else 'FAIL: ' || moderation_status || ' ' || coalesce(moderation_result, '') end from items where id = '00000000-0000-0000-0000-0000000c0001';
-- D: p(blade) = sigmoid(20·0.55 − 10) ≈ 0.73 → REVIEW, stays pending
insert into modtest.r select 'D_review', case when m.decision = 'review' and m.reasons = '{blade}' and i.moderation_status = 'pending' then 'ok' else 'FAIL: ' || m.decision || ' ' || i.moderation_status end
  from image_moderation m join items i on i.id = m.item_id where m.image_id = '00000000-0000-0000-0000-0000000d0004';
-- B safe (author only): a candidate, but not approvable yet
insert into modtest.r select 'B_candidate_not_admin_checked', case when admin_checked = false then 'ok' else 'FAIL' end from admin_safe_candidates(100) where item_id = '00000000-0000-0000-0000-0000000c0002';
insert into modtest.r select 'C_documents_never_safe_list', case when count(*) = 0 then 'ok' else 'FAIL' end from admin_safe_candidates(100) where item_id = '00000000-0000-0000-0000-0000000c0003';
insert into modtest.r select 'A_D_not_in_safe_list', case when count(*) = 0 then 'ok' else 'FAIL' end from admin_safe_candidates(100) where item_id in ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000c0004');
insert into modtest.r select 'B_bulk_refused_without_admin_vector', case when count(*) = 0 then 'ok' else 'FAIL' end
  from admin_bulk_approve(jsonb_build_array(jsonb_build_object('id', '00000000-0000-0000-0000-0000000c0002', 'updated_at', (select updated_at from items where id = '00000000-0000-0000-0000-0000000c0002'))), 'admin_test');

-- the admin's browser recomputes B's vector
select admin_set_image_embedding('00000000-0000-0000-0000-0000000d0002', '00000000-0000-0000-0000-0000000c0002', 'dinov2-s14-q4.r280-area-v1', modtest.vec(3), null);
insert into modtest.r select 'B_admin_checked', case when admin_checked then 'ok' else 'FAIL' end from admin_safe_candidates(100) where item_id = '00000000-0000-0000-0000-0000000c0002';
insert into modtest.t select 'b_seen', updated_at::text from items where id = '00000000-0000-0000-0000-0000000c0002';
insert into modtest.r select 'B_bulk_refused_when_stale', case when count(*) = 0 then 'ok' else 'FAIL' end
  from admin_bulk_approve(jsonb_build_array(jsonb_build_object('id', '00000000-0000-0000-0000-0000000c0002', 'updated_at', '2000-01-01T00:00:00Z')), 'admin_test');
insert into modtest.r select 'B_bulk_approved', case when count(*) = 1 then 'ok' else 'FAIL' end
  from admin_bulk_approve(jsonb_build_array(jsonb_build_object('id', '00000000-0000-0000-0000-0000000c0002', 'updated_at', (select v from modtest.t where k = 'b_seen'))), 'admin_test');
insert into modtest.r select 'B_status', case when moderation_status = 'approved' and moderation_result = 'approved_bulk_safe:admin_test' then 'ok' else 'FAIL: ' || moderation_status end from items where id = '00000000-0000-0000-0000-0000000c0002';

-- the admin undoes A's rejection; re-scoring in the admin's browser must not reject it again
update items set moderation_status = 'pending' where id = '00000000-0000-0000-0000-0000000c0001';
select admin_set_image_embedding('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-0000000c0001', 'dinov2-s14-q4.r280-area-v1', modtest.vec(1), null);
insert into modtest.r select 'A_undo_sticks', case when moderation_status = 'pending' then 'ok' else 'FAIL: ' || moderation_status end from items where id = '00000000-0000-0000-0000-0000000c0001';
insert into modtest.r select 'A_admin_score_still_block', case when decision = 'block' and source = 'admin' then 'ok' else 'FAIL' end from image_moderation where image_id = '00000000-0000-0000-0000-0000000d0001';

-- the engine flag does not leak out of the trigger
insert into modtest.r values ('engine_flag_off', case when coalesce(current_setting('juyo.moderation_engine', true), 'off') = 'off' then 'ok' else 'FAIL' end);

select k, v from modtest.r order by k;
rollback;
