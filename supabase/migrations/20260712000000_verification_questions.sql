-- ============================================================================
-- Ownership verification questions for "found" items
-- ============================================================================
-- Lets a finder attach 2-3 questions (from category templates, or their own)
-- to a "found" post. Anyone who wants the finder's phone number must answer
-- them first. There is deliberately NO stored "correct answer" — the finder
-- reviews each claimant's actual answers and manually approves/rejects, since
-- pre-declaring a correct answer before seeing what a real claimant types
-- turned out to be the wrong model (see conversation — auto-matching text
-- answers is unreliable, and yes/no auto-matching provides no real
-- verification because bare guessing has spam value with no accountability).
--
-- Security model: the tables themselves are locked to the item owner via RLS
-- (correct — but there's no correct_answer column left to protect; what RLS
-- protects here is the claimant's submitted answers, which only the owner
-- should see). All anonymous/claimant-facing access goes through SECURITY
-- DEFINER functions so a claimant can submit and check their own status
-- without ever being able to read other claimants' answers.
-- ============================================================================

create table if not exists public.item_verification_questions (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items(id) on delete cascade,
  question_text text not null,
  answer_type  text not null check (answer_type in ('yesno', 'input')),
  sort_order   int not null default 0,
  created_at   timestamptz default now()
);
create index if not exists idx_verification_questions_item on public.item_verification_questions(item_id);

create table if not exists public.item_verification_attempts (
  id               uuid primary key default gen_random_uuid(),
  item_id          uuid not null references public.items(id) on delete cascade,
  claimant_token   text not null, -- device-persisted anon token, or Clerk user id if logged in
  answers          jsonb not null, -- [{question_id, question_text, answer_type, given_answer}]
  status           text not null default 'pending_review' check (status in ('pending_review', 'passed', 'rejected')),
  attempt_number   int not null default 1,
  created_at       timestamptz default now(),
  reviewed_at      timestamptz
);
create index if not exists idx_verification_attempts_item on public.item_verification_attempts(item_id);
create index if not exists idx_verification_attempts_claimant on public.item_verification_attempts(item_id, claimant_token);

alter table public.item_verification_questions enable row level security;
alter table public.item_verification_attempts  enable row level security;

drop policy if exists vq_owner_manage on public.item_verification_questions;
create policy vq_owner_manage on public.item_verification_questions
  for all using (
    exists (select 1 from public.items where items.id = item_verification_questions.item_id and items.user_id = get_auth_id())
  ) with check (
    exists (select 1 from public.items where items.id = item_verification_questions.item_id and items.user_id = get_auth_id())
  );

drop policy if exists va_owner_select on public.item_verification_attempts;
create policy va_owner_select on public.item_verification_attempts
  for select using (
    exists (select 1 from public.items where items.id = item_verification_attempts.item_id and items.user_id = get_auth_id())
  );

drop policy if exists va_owner_update on public.item_verification_attempts;
create policy va_owner_update on public.item_verification_attempts
  for update using (
    exists (select 1 from public.items where items.id = item_verification_attempts.item_id and items.user_id = get_auth_id())
  );

-- Public: read question text + type only (never anything answer-like — there's
-- nothing sensitive left on this table, but keep the narrow RPC anyway so the
-- access pattern is documented and consistent with the rest of the schema).
create or replace function public.get_verification_questions(p_item_id uuid)
returns table(id uuid, question_text text, answer_type text, sort_order int)
language sql stable security definer set search_path = public
as $$
  select id, question_text, answer_type, sort_order
  from public.item_verification_questions
  where item_id = p_item_id
  order by sort_order;
$$;
grant execute on function public.get_verification_questions(uuid) to anon, authenticated;

-- Claimant submits their answers. No auto-verification — always lands in
-- pending_review for the owner to judge. No attempt cap: a rejected claimant
-- may always resubmit — spam risk is already bounded by manual owner review
-- (every attempt requires the owner to act), so a lockout only blocks
-- legitimate retries without stopping spam.
create or replace function public.submit_verification_attempt(p_item_id uuid, p_claimant_token text, p_answers jsonb)
returns table(status text, phone text)
language plpgsql security definer set search_path = public
as $$
declare
  v_prev_status text;
  v_prev_count int;
  v_answer jsonb;
  v_q record;
  v_result_answers jsonb := '[]'::jsonb;
  v_phone text;
begin
  select (array_agg(a.status order by a.created_at desc))[1], count(*)
    into v_prev_status, v_prev_count
    from public.item_verification_attempts a
    where a.item_id = p_item_id and a.claimant_token = p_claimant_token;

  if v_prev_status = 'passed' then
    select items.phone_number into v_phone from public.items where items.id = p_item_id;
    return query select 'passed'::text, v_phone;
    return;
  end if;

  if v_prev_status = 'pending_review' then
    return query select 'pending_review'::text, null::text;
    return;
  end if;

  for v_answer in select * from jsonb_array_elements(p_answers)
  loop
    select q.id, q.question_text, q.answer_type into v_q
      from public.item_verification_questions q
      where q.id = (v_answer->>'question_id')::uuid and q.item_id = p_item_id;

    if v_q.id is null then continue; end if;

    v_result_answers := v_result_answers || jsonb_build_object(
      'question_id', v_q.id,
      'question_text', v_q.question_text,
      'answer_type', v_q.answer_type,
      'given_answer', v_answer->>'given_answer'
    );
  end loop;

  insert into public.item_verification_attempts (item_id, claimant_token, answers, status, attempt_number)
  values (p_item_id, p_claimant_token, v_result_answers, 'pending_review', coalesce(v_prev_count, 0) + 1);

  return query select 'pending_review'::text, null::text;
end;
$$;
grant execute on function public.submit_verification_attempt(uuid, text, jsonb) to anon, authenticated;

-- Claimant polls this to find out if the owner has reviewed them yet.
create or replace function public.get_verification_status(p_item_id uuid, p_claimant_token text)
returns table(status text, phone text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_status text;
  v_phone text;
begin
  select a.status into v_status
    from public.item_verification_attempts a
    where a.item_id = p_item_id and a.claimant_token = p_claimant_token
    order by a.created_at desc
    limit 1;

  if v_status is null then
    return query select 'none'::text, null::text;
    return;
  end if;

  if v_status = 'passed' then
    select items.phone_number into v_phone from public.items where items.id = p_item_id;
  end if;

  return query select v_status, v_phone;
end;
$$;
grant execute on function public.get_verification_status(uuid, text) to anon, authenticated;

-- Owner approves/rejects a pending attempt.
create or replace function public.review_verification_attempt(p_attempt_id uuid, p_approve boolean)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_owner text;
begin
  select items.user_id into v_owner
    from public.item_verification_attempts a
    join public.items on items.id = a.item_id
    where a.id = p_attempt_id;

  if v_owner is null or v_owner <> get_auth_id() then
    raise exception 'Not authorized';
  end if;

  update public.item_verification_attempts a
  set status = case when p_approve then 'passed' else 'rejected' end,
      reviewed_at = now()
  where a.id = p_attempt_id;

  return true;
end;
$$;
grant execute on function public.review_verification_attempt(uuid, boolean) to authenticated;
