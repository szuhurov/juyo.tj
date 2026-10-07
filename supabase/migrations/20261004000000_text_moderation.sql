-- Text moderation without AI (owner decision 2026-10-04).
--
-- check_listing_text(title, description) → { verdict, hits[], signals[] }
--   verdict: allow | warn | review | block
--   hits:    { field, start (0-based), length, text, category, severity }
--            so the apps can highlight the exact words and let the poster fix them.
-- items_text_moderation trigger: BLOCK rejects the write for normal users
-- (admin/service-role edits are not blocked); everything else is stored in
-- items.text_moderation for the admin queue.
--
-- Matching is deterministic: a curated dictionary (moderation_terms) in
-- Tajik, Russian and English, compiled to regexes that survive common
-- obfuscation (s.p.a.c.e.d letters, repeated letters, Latin/Cyrillic
-- look-alikes, leetspeak digits), plus spam heuristics. Folding is 1:1 per
-- character so match positions are positions in the original text.

create table if not exists public.moderation_terms (
  id bigint generated always as identity primary key,
  term text not null,
  kind text not null check (kind in ('word', 'prefix', 'phrase')),
  script text not null check (script in ('cyr', 'lat')),
  category text not null check (category in ('profanity', 'insult', 'threat', 'hate', 'scam', 'spam', 'drugs', 'weapons', 'adult')),
  severity text not null check (severity in ('warn', 'review', 'block')),
  pattern text not null default '',
  unique (term, kind, script)
);
alter table public.moderation_terms enable row level security;
-- No policies: the list is read only by the SECURITY DEFINER functions below.

alter table public.items add column if not exists text_moderation jsonb;

-- 1:1 character folds (length-preserving, so regex positions stay valid).
create or replace function public.moderation_fold_cyr(t text)
returns text language sql immutable parallel safe set search_path = '' as $$
  -- Latin look-alikes and leetspeak → Cyrillic; Tajik letters → Russian.
  select translate(lower(coalesce(t, '')),
    'aceopxykmtbhunr03@6ҳқғӯӣҷё',
    'асеорхукмтвнипгозабхкгуиче');
$$;

create or replace function public.moderation_fold_lat(t text)
returns text language sql immutable parallel safe set search_path = '' as $$
  -- Cyrillic look-alikes and leetspeak → Latin.
  select translate(lower(coalesce(t, '')), 'асеорхукмтв01345@$!', 'aceopxykmtboieasasi');
$$;

-- term → regex: every letter may repeat ("сууука") and be separated by
-- punctuation/spaces ("с.у.к.а", "с у к а"); word terms need a non-letter
-- on both sides, prefix terms only before. Group 2 is the term itself.
create or replace function public.moderation_term_pattern(p_term text, p_kind text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v_sep constant text := '[[:space:]._*,''"`~|/\\-]*';
  v_words text[] := regexp_split_to_array(btrim(p_term), '\s+');
  v_parts text[] := '{}';
  v_w text;
  v_letters text[];
begin
  foreach v_w in array v_words loop
    select array_agg(regexp_replace(ch, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '+') into v_letters
      from regexp_split_to_table(v_w, '') ch;
    v_parts := array_append(v_parts, array_to_string(v_letters, case when p_kind = 'phrase' then '' else v_sep end));
  end loop;
  return '(^|[^[:alpha:]])(' || array_to_string(v_parts, '[[:space:][:punct:]]+') || ')'
    || case when p_kind = 'prefix' then '' else '($|[^[:alpha:]])' end;
end;
$$;

create or replace function public.moderation_terms_compile()
returns trigger language plpgsql set search_path = public as $$
begin
  new.term := lower(btrim(new.term));
  new.pattern := public.moderation_term_pattern(new.term, new.kind);
  return new;
end;
$$;

drop trigger if exists moderation_terms_compile_trigger on public.moderation_terms;
create trigger moderation_terms_compile_trigger
  before insert or update of term, kind on public.moderation_terms
  for each row execute function public.moderation_terms_compile();

create or replace function public.check_listing_text(p_title text, p_description text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hits jsonb := '[]'::jsonb;
  v_signals jsonb := '[]'::jsonb;
  v_field text;
  v_text text;
  v_cyr text;
  v_lat text;
  v_folded text;
  r record;
  n int;
  v_start int;
  v_end int;
  v_letters int;
  v_upper int;
  v_rank int := 0;
  v_sev_rank constant jsonb := '{"warn":1,"review":2,"block":3}';
begin
  foreach v_field in array array['title', 'description'] loop
    v_text := left(coalesce(case v_field when 'title' then p_title else p_description end, ''), 5000);
    continue when v_text = '';
    v_cyr := public.moderation_fold_cyr(v_text);
    v_lat := public.moderation_fold_lat(v_text);

    for r in select term, category, severity, script, pattern from public.moderation_terms loop
      v_folded := case r.script when 'cyr' then v_cyr else v_lat end;
      n := 1;
      loop
        v_start := regexp_instr(v_folded, r.pattern, 1, n, 0, '', 2);
        exit when v_start = 0 or n > 20;
        v_end := regexp_instr(v_folded, r.pattern, 1, n, 1, '', 2);
        v_hits := v_hits || jsonb_build_object(
          'field', v_field, 'start', v_start - 1, 'length', v_end - v_start,
          'text', substr(v_text, v_start, v_end - v_start),
          'category', r.category, 'severity', r.severity);
        v_rank := greatest(v_rank, (v_sev_rank ->> r.severity)::int);
        n := n + 1;
      end loop;
    end loop;

    -- Links: a lost-and-found listing has no reason to send people elsewhere.
    if v_text ~* '(https?://|www\.|t\.me/|wa\.me/|bit\.ly/)' then
      v_signals := v_signals || jsonb_build_object('field', v_field, 'signal', 'link', 'severity', 'review');
      v_rank := greatest(v_rank, 2);
    end if;
    -- Many phone numbers in free text: typical of ads.
    if (select count(*) from regexp_matches(v_text, '(\+?992)?[ -]?\d{2}[ -]?\d{3}[ -]?\d{2}[ -]?\d{2}', 'g')) >= 3 then
      v_signals := v_signals || jsonb_build_object('field', v_field, 'signal', 'many_phones', 'severity', 'review');
      v_rank := greatest(v_rank, 2);
    end if;
    -- Repetition: the same character 6+ times, or one word 4+ times.
    if v_text ~ '(.)\1{5,}' then
      v_signals := v_signals || jsonb_build_object('field', v_field, 'signal', 'repeated_characters', 'severity', 'warn');
      v_rank := greatest(v_rank, 1);
    end if;
    if exists (
      select 1 from regexp_split_to_table(lower(v_text), '[^[:alnum:]]+') w
      where char_length(w) >= 3 group by w having count(*) >= 4
    ) then
      v_signals := v_signals || jsonb_build_object('field', v_field, 'signal', 'repeated_words', 'severity', 'review');
      v_rank := greatest(v_rank, 2);
    end if;
    -- Shouting: mostly capitals in a long text.
    v_letters := char_length(regexp_replace(v_text, '[^[:alpha:]]', '', 'g'));
    v_upper := char_length(regexp_replace(v_text, '[^[:upper:]]', '', 'g'));
    if v_letters >= 30 and v_upper::numeric / v_letters > 0.7 then
      v_signals := v_signals || jsonb_build_object('field', v_field, 'signal', 'all_caps', 'severity', 'warn');
      v_rank := greatest(v_rank, 1);
    end if;
  end loop;

  return jsonb_build_object(
    'verdict', case v_rank when 3 then 'block' when 2 then 'review' when 1 then 'warn' else 'allow' end,
    'hits', v_hits,
    'signals', v_signals);
end;
$$;

revoke all on function public.check_listing_text(text, text) from public;
grant execute on function public.check_listing_text(text, text) to anon, authenticated;

create or replace function public.items_text_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_claims text := current_setting('request.jwt.claims', true);
  v_privileged boolean := v_claims is null or (v_claims::json ->> 'role') = 'service_role';
begin
  if tg_op = 'UPDATE' and new.title is not distinct from old.title and new.description is not distinct from old.description then
    return new;
  end if;
  v_result := public.check_listing_text(new.title, new.description);

  -- The same poster repeating (almost) the same text: spam.
  if (select count(*) from public.items i
       where i.user_id = new.user_id and i.id <> new.id
         and i.created_at > now() - interval '7 days'
         and similarity(coalesce(i.description, ''), coalesce(new.description, '')) > 0.9) >= 2 then
    v_result := jsonb_set(v_result, '{signals}', (v_result -> 'signals') || '[{"signal":"duplicate_posts","severity":"review"}]'::jsonb);
    if v_result ->> 'verdict' in ('allow', 'warn') then
      v_result := jsonb_set(v_result, '{verdict}', '"review"');
    end if;
  end if;

  if v_result ->> 'verdict' = 'block' and not v_privileged then
    raise exception using
      errcode = 'P0001',
      message = 'JUYO_TEXT_BLOCKED',
      detail = (v_result -> 'hits')::text,
      hint = 'Fix the highlighted words and try again.';
  end if;

  new.text_moderation := v_result || jsonb_build_object('checked_at', now());
  return new;
end;
$$;

drop trigger if exists items_text_moderation_trigger on public.items;
create trigger items_text_moderation_trigger
  before insert or update of title, description on public.items
  for each row execute function public.items_text_moderation();

-- Dictionary (curated; extend with INSERTs — the trigger compiles patterns).
-- Terms are stored already folded (Tajik ҷ→ч, ӯ→у, ҳ→х…), matching moderation_fold_cyr.
-- Words with an everyday second meaning are left out on purpose (e.g. Tajik
-- "кун" = "do", "мекушам" = also "I try" once ӯ is folded).
insert into public.moderation_terms (term, kind, script, category, severity) values
  ('хуй', 'prefix', 'cyr', 'profanity', 'block'),
  ('хуе', 'prefix', 'cyr', 'profanity', 'block'),
  ('хуе', 'prefix', 'cyr', 'profanity', 'block'),
  ('хуя', 'prefix', 'cyr', 'profanity', 'block'),
  ('пизд', 'prefix', 'cyr', 'profanity', 'block'),
  ('ебат', 'prefix', 'cyr', 'profanity', 'block'),
  ('ебан', 'prefix', 'cyr', 'profanity', 'block'),
  ('ебал', 'prefix', 'cyr', 'profanity', 'block'),
  ('заеб', 'prefix', 'cyr', 'profanity', 'block'),
  ('выеб', 'prefix', 'cyr', 'profanity', 'block'),
  ('наеб', 'prefix', 'cyr', 'profanity', 'block'),
  ('уеб', 'prefix', 'cyr', 'profanity', 'block'),
  ('отъеб', 'prefix', 'cyr', 'profanity', 'block'),
  ('проеб', 'prefix', 'cyr', 'profanity', 'block'),
  ('долбоеб', 'prefix', 'cyr', 'profanity', 'block'),
  ('бляд', 'prefix', 'cyr', 'profanity', 'block'),
  ('мудак', 'prefix', 'cyr', 'profanity', 'block'),
  ('мудил', 'prefix', 'cyr', 'profanity', 'block'),
  ('пидор', 'prefix', 'cyr', 'profanity', 'block'),
  ('пидар', 'prefix', 'cyr', 'profanity', 'block'),
  ('педик', 'prefix', 'cyr', 'profanity', 'block'),
  ('гандон', 'prefix', 'cyr', 'profanity', 'block'),
  ('залуп', 'prefix', 'cyr', 'profanity', 'block'),
  ('шлюх', 'prefix', 'cyr', 'profanity', 'block'),
  ('сучк', 'prefix', 'cyr', 'profanity', 'block'),
  ('сучар', 'prefix', 'cyr', 'profanity', 'block'),
  ('бля', 'word', 'cyr', 'profanity', 'block'),
  ('сука', 'word', 'cyr', 'profanity', 'block'),
  ('суки', 'word', 'cyr', 'profanity', 'block'),
  ('суку', 'word', 'cyr', 'profanity', 'block'),
  ('сукой', 'word', 'cyr', 'profanity', 'block'),
  ('мразь', 'word', 'cyr', 'profanity', 'block'),
  ('ебу', 'word', 'cyr', 'profanity', 'block'),
  ('дебил', 'word', 'cyr', 'insult', 'review'),
  ('идиот', 'word', 'cyr', 'insult', 'review'),
  ('урод', 'word', 'cyr', 'insult', 'review'),
  ('тварь', 'word', 'cyr', 'insult', 'review'),
  ('скотина', 'word', 'cyr', 'insult', 'review'),
  ('дурак', 'word', 'cyr', 'insult', 'review'),
  ('чмо', 'word', 'cyr', 'insult', 'review'),
  ('лох', 'word', 'cyr', 'insult', 'review'),
  ('чалаб', 'word', 'cyr', 'profanity', 'block'),
  ('харкус', 'word', 'cyr', 'profanity', 'block'),
  ('кусмодар', 'word', 'cyr', 'profanity', 'block'),
  ('кутак', 'word', 'cyr', 'profanity', 'block'),
  ('кусат', 'word', 'cyr', 'profanity', 'block'),
  ('кири', 'word', 'cyr', 'profanity', 'block'),
  ('падарсаг', 'word', 'cyr', 'profanity', 'block'),
  ('модарсаг', 'word', 'cyr', 'profanity', 'block'),
  ('сагпадар', 'word', 'cyr', 'profanity', 'block'),
  ('кус', 'word', 'cyr', 'profanity', 'review'),
  ('кир', 'word', 'cyr', 'profanity', 'review'),
  ('падарлаънат', 'word', 'cyr', 'insult', 'review'),
  ('харсага', 'word', 'cyr', 'insult', 'review'),
  ('бешараф', 'word', 'cyr', 'insult', 'review'),
  ('ахмак', 'word', 'cyr', 'insult', 'review'),
  ('suka', 'word', 'lat', 'profanity', 'block'),
  ('blyat', 'prefix', 'lat', 'profanity', 'block'),
  ('blya', 'word', 'lat', 'profanity', 'block'),
  ('nahuy', 'prefix', 'lat', 'profanity', 'block'),
  ('nahui', 'prefix', 'lat', 'profanity', 'block'),
  ('pizd', 'word', 'lat', 'profanity', 'block'),
  ('huy', 'word', 'lat', 'profanity', 'block'),
  ('huj', 'word', 'lat', 'profanity', 'block'),
  ('ebat', 'word', 'lat', 'profanity', 'block'),
  ('ebal', 'word', 'lat', 'profanity', 'block'),
  ('pidor', 'prefix', 'lat', 'profanity', 'block'),
  ('mudak', 'prefix', 'lat', 'profanity', 'block'),
  ('jalab', 'prefix', 'lat', 'profanity', 'block'),
  ('chalab', 'prefix', 'lat', 'profanity', 'block'),
  ('kusmodar', 'prefix', 'lat', 'profanity', 'block'),
  ('kutak', 'prefix', 'lat', 'profanity', 'block'),
  ('fuck', 'prefix', 'lat', 'profanity', 'block'),
  ('motherfuck', 'prefix', 'lat', 'profanity', 'block'),
  ('shit', 'prefix', 'lat', 'profanity', 'block'),
  ('bitch', 'prefix', 'lat', 'profanity', 'block'),
  ('cunt', 'prefix', 'lat', 'profanity', 'block'),
  ('asshole', 'prefix', 'lat', 'profanity', 'block'),
  ('whore', 'prefix', 'lat', 'profanity', 'block'),
  ('slut', 'prefix', 'lat', 'profanity', 'block'),
  ('dick', 'word', 'lat', 'insult', 'review'),
  ('bastard', 'word', 'lat', 'insult', 'review'),
  ('idiot', 'word', 'lat', 'insult', 'review'),
  ('moron', 'word', 'lat', 'insult', 'review'),
  ('чурка', 'word', 'cyr', 'hate', 'block'),
  ('хач', 'word', 'cyr', 'hate', 'block'),
  ('жид', 'word', 'cyr', 'hate', 'block'),
  ('нигер', 'word', 'cyr', 'hate', 'block'),
  ('nigger', 'prefix', 'lat', 'hate', 'block'),
  ('nigga', 'prefix', 'lat', 'hate', 'block'),
  ('faggot', 'prefix', 'lat', 'hate', 'block'),
  ('убью', 'word', 'cyr', 'threat', 'block'),
  ('зарежу', 'word', 'cyr', 'threat', 'block'),
  ('застрелю', 'word', 'cyr', 'threat', 'block'),
  ('прикончу', 'word', 'cyr', 'threat', 'block'),
  ('туро мекушам', 'phrase', 'cyr', 'threat', 'block'),
  ('шуморо мекушам', 'phrase', 'cyr', 'threat', 'block'),
  ('я тебя убью', 'phrase', 'cyr', 'threat', 'block'),
  ('тебе конец', 'phrase', 'cyr', 'threat', 'block'),
  ('kill you', 'phrase', 'lat', 'threat', 'block'),
  ('i will kill', 'phrase', 'lat', 'threat', 'block'),
  ('предоплат', 'prefix', 'cyr', 'scam', 'review'),
  ('пешпардохт', 'prefix', 'cyr', 'scam', 'review'),
  ('пешакй пардохт', 'prefix', 'cyr', 'scam', 'review'),
  ('переведите деньги', 'phrase', 'cyr', 'scam', 'review'),
  ('отправьте деньги', 'phrase', 'cyr', 'scam', 'review'),
  ('скиньте деньги', 'phrase', 'cyr', 'scam', 'review'),
  ('оплата вперед', 'phrase', 'cyr', 'scam', 'review'),
  ('пул фиристед', 'phrase', 'cyr', 'scam', 'review'),
  ('пулро гузаронед', 'phrase', 'cyr', 'scam', 'review'),
  ('пеш аз пардохт', 'phrase', 'cyr', 'scam', 'review'),
  ('код из смс', 'phrase', 'cyr', 'scam', 'review'),
  ('смс код', 'phrase', 'cyr', 'scam', 'review'),
  ('рамзи смс', 'phrase', 'cyr', 'scam', 'review'),
  ('коди смс', 'phrase', 'cyr', 'scam', 'review'),
  ('номер карты', 'phrase', 'cyr', 'scam', 'review'),
  ('раками корт', 'phrase', 'cyr', 'scam', 'review'),
  ('данные карты', 'phrase', 'cyr', 'scam', 'review'),
  ('cvv', 'phrase', 'lat', 'scam', 'review'),
  ('send money', 'phrase', 'lat', 'scam', 'review'),
  ('prepayment', 'phrase', 'lat', 'scam', 'review'),
  ('sms code', 'phrase', 'lat', 'scam', 'review'),
  ('card number', 'phrase', 'lat', 'scam', 'review'),
  ('казино', 'prefix', 'cyr', 'spam', 'review'),
  ('ставк', 'prefix', 'cyr', 'spam', 'review'),
  ('букмекер', 'prefix', 'cyr', 'spam', 'review'),
  ('заработ', 'prefix', 'cyr', 'spam', 'review'),
  ('инвест', 'prefix', 'cyr', 'spam', 'review'),
  ('криптовалют', 'prefix', 'cyr', 'spam', 'review'),
  ('кредит', 'prefix', 'cyr', 'spam', 'review'),
  ('займ', 'prefix', 'cyr', 'spam', 'review'),
  ('микрозайм', 'prefix', 'cyr', 'spam', 'review'),
  ('1xbet', 'word', 'lat', 'spam', 'review'),
  ('casino', 'word', 'lat', 'spam', 'review'),
  ('betting', 'word', 'lat', 'spam', 'review'),
  ('crypto', 'word', 'lat', 'spam', 'review'),
  ('forex', 'word', 'lat', 'spam', 'review'),
  ('loan', 'word', 'lat', 'spam', 'review'),
  ('подписывайтесь', 'word', 'cyr', 'spam', 'warn'),
  ('подпишись', 'word', 'cyr', 'spam', 'warn'),
  ('реклама', 'word', 'cyr', 'spam', 'warn'),
  ('акция', 'word', 'cyr', 'spam', 'warn'),
  ('скидка', 'word', 'cyr', 'spam', 'warn'),
  ('закладк', 'prefix', 'cyr', 'drugs', 'block'),
  ('спайс', 'prefix', 'cyr', 'drugs', 'block'),
  ('мефедрон', 'prefix', 'cyr', 'drugs', 'block'),
  ('героин', 'prefix', 'cyr', 'drugs', 'block'),
  ('гашиш', 'prefix', 'cyr', 'drugs', 'block'),
  ('кокаин', 'prefix', 'cyr', 'drugs', 'block'),
  ('амфетамин', 'prefix', 'cyr', 'drugs', 'block'),
  ('экстази', 'prefix', 'cyr', 'drugs', 'block'),
  ('наркотик', 'prefix', 'cyr', 'drugs', 'review'),
  ('марихуан', 'prefix', 'cyr', 'drugs', 'review'),
  ('анаша', 'prefix', 'cyr', 'drugs', 'review'),
  ('план', 'word', 'cyr', 'drugs', 'warn'),
  ('cocaine', 'word', 'lat', 'drugs', 'review'),
  ('heroin', 'word', 'lat', 'drugs', 'review'),
  ('meth', 'word', 'lat', 'drugs', 'review'),
  ('weed', 'word', 'lat', 'drugs', 'review'),
  ('пистолет', 'prefix', 'cyr', 'weapons', 'review'),
  ('оружи', 'prefix', 'cyr', 'weapons', 'review'),
  ('патрон', 'prefix', 'cyr', 'weapons', 'review'),
  ('граната', 'prefix', 'cyr', 'weapons', 'review'),
  ('автомат калашникова', 'phrase', 'cyr', 'weapons', 'review'),
  ('ярок', 'prefix', 'cyr', 'weapons', 'review'),
  ('туфанг', 'prefix', 'cyr', 'weapons', 'review'),
  ('pistol', 'word', 'lat', 'weapons', 'review'),
  ('gun', 'word', 'lat', 'weapons', 'review'),
  ('ammo', 'word', 'lat', 'weapons', 'review'),
  ('grenade', 'word', 'lat', 'weapons', 'review'),
  ('проститут', 'prefix', 'cyr', 'adult', 'block'),
  ('интим услуг', 'phrase', 'cyr', 'adult', 'review'),
  ('эскорт', 'prefix', 'cyr', 'adult', 'review'),
  ('порн', 'prefix', 'cyr', 'adult', 'block'),
  ('porn', 'word', 'lat', 'adult', 'block'),
  ('escort', 'word', 'lat', 'adult', 'block'),
  ('sex service', 'phrase', 'lat', 'adult', 'block')
on conflict (term, kind, script) do nothing;
