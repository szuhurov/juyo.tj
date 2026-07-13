-- ============================================================================
-- Verification flow: collect the claimant's own phone number when they
-- answer ownership questions, and let the item owner see whether that number
-- belongs to an existing JUYO account (name/avatar) when reviewing a claim —
-- extra trust signal beyond the raw Q&A answers.
-- ============================================================================

alter table public.item_verification_attempts add column if not exists claimant_phone text;

-- submit_verification_attempt gains a trailing optional param — existing
-- callers (old client builds) keep working with claimant_phone = null.
create or replace function public.submit_verification_attempt(
  p_item_id uuid,
  p_claimant_token text,
  p_answers jsonb,
  p_claimant_phone text default null
)
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

  insert into public.item_verification_attempts (item_id, claimant_token, answers, status, attempt_number, claimant_phone)
  values (p_item_id, p_claimant_token, v_result_answers, 'pending_review', coalesce(v_prev_count, 0) + 1, nullif(trim(p_claimant_phone), ''));

  return query select 'pending_review'::text, null::text;
end;
$$;
grant execute on function public.submit_verification_attempt(uuid, text, jsonb, text) to anon, authenticated;

-- Owner-only: pending attempts on one of their items, each matched against
-- profiles by phone/secondary_phone. SECURITY DEFINER so it can read
-- profiles.phone (never publicly readable — see public_profiles view) without
-- opening a general phone-lookup surface: the caller must own the item, and
-- only sees matches for numbers actually submitted as claims on that item.
create or replace function public.get_pending_verification_attempts(p_item_id uuid)
returns table(
  id uuid,
  answers jsonb,
  status text,
  created_at timestamptz,
  claimant_phone text,
  matched_user_id text,
  matched_first_name text,
  matched_last_name text,
  matched_avatar_url text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.items where items.id = p_item_id and items.user_id = get_auth_id()) then
    raise exception 'Not authorized';
  end if;

  return query
    select
      a.id, a.answers, a.status, a.created_at, a.claimant_phone,
      m.id, m.first_name, m.last_name, m.avatar_url
    from public.item_verification_attempts a
    left join lateral (
      select p.id, p.first_name, p.last_name, p.avatar_url
      from public.profiles p
      where a.claimant_phone is not null
        and (p.phone = a.claimant_phone or p.secondary_phone = a.claimant_phone)
      limit 1
    ) m on true
    where a.item_id = p_item_id and a.status = 'pending_review'
    order by a.created_at desc;
end;
$$;
grant execute on function public.get_pending_verification_attempts(uuid) to authenticated;
