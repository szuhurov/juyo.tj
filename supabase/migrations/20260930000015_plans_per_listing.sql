-- ============================================================================
-- TOP / VIP belong to a LISTING, not to its owner.
--
-- Bug (live, 2026-09-24): an admin posted listing A with VIP (tier vvip),
-- then listing B with TOP (tier vip). Activating B's subscription ran
-- admin_activate_subscription, which "superseded" (expired) every other
-- active subscription of the same user — so A's VIP was silently expired,
-- and because the tier was resolved per USER (active_vip_tiers joined on
-- user_id) every listing of that user, A included, now showed TOP and fell
-- back in the ranking. create_subscription likewise cancelled the user's
-- other pending requests, whatever listing they were for.
--
-- Fix:
--   * subscriptions.item_id: the listing a plan was bought for (null for the
--     older account-wide purchases from the /vip page, which keep applying
--     to all of that user's listings, as before).
--   * create_subscription(p_plan_id, p_item_id default null): checks the
--     listing is the caller's; replaces only a pending request for the SAME
--     listing. The one-argument call of already-shipped clients still works.
--   * admin_activate_subscription: supersedes only the active subscription
--     of the SAME listing (or, for account-wide ones, other account-wide
--     ones) — never another listing's plan.
--   * VIP (vvip) stays exclusive platform-wide: one active VIP at a time,
--     except renewing the same listing.
--   * active_item_tiers(): per-listing tier (listing plan, else account-wide
--     plan; best tier, then highest price). search_items / get_vip_items
--     rank and badge by it. active_vip_tiers() is kept for compatibility.
--   * release trigger: a listing-level VIP ends when THAT listing is
--     deleted / resolved / rejected; account-wide VIP keeps the old rule
--     (ends when the owner has no live listing left).
--   * Data repair: the two live subscriptions are linked to the listings
--     they were bought with (created seconds after each listing), and the
--     VIP expired by the bug is restored for its remaining period.
--
-- Clients: app/ passes the new listing's id when a plan is chosen in the
-- add flow; shipped builds (no item id) keep the account-wide behaviour.
--
-- Rollback:
--   re-run 20260930000011_vvip_first_and_release.sql and the
--   create_subscription / admin_activate_subscription definitions from
--   20260930000008_vvip_exclusive.sql / 20260930000009_subscription_replace_pending.sql,
--   drop function if exists public.active_item_tiers();
--   alter table public.subscriptions drop column if exists item_id;
-- ============================================================================
select similarity('warmup', 'warmup');

begin;

alter table public.subscriptions
  add column if not exists item_id uuid references public.items(id) on delete set null;
create index if not exists subscriptions_item_id_idx on public.subscriptions (item_id) where item_id is not null;

drop function if exists public.create_subscription(uuid);

create or replace function public.create_subscription(p_plan_id uuid, p_item_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := get_auth_id();
  v_plan public.vip_plans%rowtype;
  v_sub_id uuid;
  v_old record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_plan from public.vip_plans where id = p_plan_id and is_active = true;
  if not found then
    raise exception 'Unknown or inactive plan';
  end if;

  if p_item_id is not null and not exists (
    select 1 from public.items where id = p_item_id and user_id = v_user_id
  ) then
    raise exception 'Listing not found';
  end if;

  -- one VIP (vvip) on the whole platform at a time; renewing the same
  -- listing is allowed
  if v_plan.tier = 'vvip' and exists (
    select 1 from public.subscriptions
    where tier = 'vvip' and status = 'active' and expires_at > now()
      and not (user_id = v_user_id and item_id is not distinct from p_item_id)
  ) then
    raise exception 'VIP is currently taken';
  end if;

  -- a new request replaces only the pending one for the SAME listing
  for v_old in
    select id from public.subscriptions
    where user_id = v_user_id and status = 'pending' and item_id is not distinct from p_item_id
  loop
    update public.subscriptions
    set status = 'cancelled', cancelled_at = now(), cancelled_by = v_user_id,
        cancel_reason = 'replaced', updated_at = now()
    where id = v_old.id;
    insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id)
    values (v_old.id, v_user_id, 'cancelled', 'user', v_user_id);
  end loop;

  insert into public.subscriptions (user_id, plan_id, tier, duration_days, price_tjs, currency, item_id)
  values (v_user_id, v_plan.id, v_plan.tier, v_plan.duration_days, v_plan.price_tjs, v_plan.currency, p_item_id)
  returning id into v_sub_id;

  insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id)
  values (v_sub_id, v_user_id, 'created', 'user', v_user_id);

  return v_sub_id;
end;
$$;

revoke all on function public.create_subscription(uuid, uuid) from public, anon;
grant execute on function public.create_subscription(uuid, uuid) to authenticated;

create or replace function public.admin_activate_subscription(p_subscription_id uuid, p_admin_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_superseded record;
  v_starts timestamptz := now();
  v_expires timestamptz;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'Subscription not found';
  end if;
  if v_sub.status <> 'pending' then
    raise exception 'Only a pending subscription can be activated';
  end if;

  if v_sub.tier = 'vvip' and exists (
    select 1 from public.subscriptions
    where tier = 'vvip' and status = 'active' and expires_at > now()
      and not (user_id = v_sub.user_id and item_id is not distinct from v_sub.item_id)
  ) then
    raise exception 'VIP is currently taken';
  end if;

  v_expires := v_starts + make_interval(days => v_sub.duration_days);

  -- only the plan of the SAME listing (or account-wide vs account-wide) is
  -- replaced — another listing's TOP/VIP is never touched
  for v_superseded in
    select id from public.subscriptions
    where user_id = v_sub.user_id and status = 'active' and id <> p_subscription_id
      and item_id is not distinct from v_sub.item_id
  loop
    update public.subscriptions set status = 'expired', updated_at = now() where id = v_superseded.id;
    insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id, metadata)
    values (v_superseded.id, v_sub.user_id, 'expired', 'system', p_admin_id, jsonb_build_object('reason', 'superseded'));
  end loop;

  update public.subscriptions
  set status = 'active', starts_at = v_starts, expires_at = v_expires, updated_at = now()
  where id = p_subscription_id;

  insert into public.payment_events (subscription_id, user_id, amount_tjs, status, confirmed_by)
  values (p_subscription_id, v_sub.user_id, v_sub.price_tjs, 'confirmed', p_admin_id);

  insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id)
  values (p_subscription_id, v_sub.user_id, 'payment_confirmed', 'admin', p_admin_id);
  insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id)
  values (p_subscription_id, v_sub.user_id, 'activated', 'admin', p_admin_id);
end;
$$;

-- Per-listing tier: the listing's own plan, else an account-wide plan of its
-- owner; best tier first, then the highest price paid.
create or replace function public.active_item_tiers()
returns table (item_id uuid, tier text, feed_boost_hours integer, starts_at timestamptz, price_tjs numeric)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (i.id) i.id, s.tier, b.feed_boost_hours, s.starts_at, s.price_tjs::numeric
  from public.subscriptions s
  join public.vip_tier_benefits b on b.tier = s.tier
  join public.items i on (s.item_id = i.id) or (s.item_id is null and i.user_id = s.user_id)
  where s.status = 'active' and s.expires_at > now()
  order by i.id, case s.tier when 'vvip' then 2 else 1 end desc, s.price_tjs desc, s.starts_at desc;
$$;

revoke all on function public.active_item_tiers() from public;
grant execute on function public.active_item_tiers() to anon, authenticated;

create or replace function public.get_vip_items(p_limit integer default 20)
returns table (
  id uuid, user_id text, title text, description text, category text, type item_type,
  date date, reward text, created_at timestamptz, is_resolved boolean,
  moderation_status moderation_status, images jsonb, vip_tier text
)
language sql
stable
set search_path = public
as $$
  select
    i.id, i.user_id, i.title, i.description, i.category, i.type, i.date,
    i.reward, i.created_at, i.is_resolved, i.moderation_status,
    coalesce((select jsonb_agg(jsonb_build_object('image_url', img.image_url, 'thumbnail_url', img.thumbnail_url) order by img.created_at)
              from item_images img where img.item_id = i.id), '[]'::jsonb) as images,
    v.tier as vip_tier
  from public.active_item_tiers() v
  join public.items i on i.id = v.item_id
  where (i.status is null or i.status <> 'deleted')
    and i.moderation_status = 'approved'
    and (i.is_resolved = false or i.is_resolved is null)
  order by case v.tier when 'vvip' then 0 else 1 end,
           v.price_tjs desc nulls last,
           v.starts_at desc nulls last,
           i.date desc, i.created_at desc, i.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create or replace function public.search_items(
  p_search text default null,
  p_category text default null,
  p_type text default null,
  p_user_id text default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_date_from date default null,
  p_date_to date default null,
  p_location_type text default null,
  p_city text default null
)
returns table (
  id uuid, user_id text, title text, description text, category text, type item_type,
  date date, reward text, created_at timestamptz, is_resolved boolean,
  moderation_status moderation_status, images jsonb, vip_tier text
)
language plpgsql
stable
set search_path = public
set pg_trgm.similarity_threshold = 0.25
as $fn$
begin
  return query execute $q$
    select
      i.id, i.user_id, i.title, i.description, i.category, i.type, i.date,
      i.reward, i.created_at, i.is_resolved, i.moderation_status,
      coalesce((select jsonb_agg(jsonb_build_object('image_url', img.image_url, 'thumbnail_url', img.thumbnail_url) order by img.created_at)
                from item_images img where img.item_id = i.id), '[]'::jsonb) as images,
      coalesce(vip.tier, 'none') as vip_tier
    from (
      -- The query is capped at 200 characters HERE (the RPC is public): an
      -- unbounded string would build a tsquery word over Postgres' 2046-byte
      -- limit and raise an error.
      -- q_raw keeps the client's backslash escapes (\% \_ \\) and is used ONLY
      -- by ilike, where backslash is the escape character. q_plain strips them
      -- and feeds everything else (folding, FTS, trigram, length checks).
      select nullif(btrim(left($1, 200)), '') as q_raw,
             nullif(btrim(replace(left($1, 200), '\', '')), '') as q_plain,
             public.get_auth_id() as me
    ) s0
    cross join lateral (
      select s0.q_raw, s0.q_plain, s0.me,
             case when s0.q_plain is null then null else public.search_fold(s0.q_plain) end as q_fold
    ) sa
    cross join lateral public.search_build_queries(sa.q_plain) sq
    cross join items i
    cross join lateral (
      select case when sa.q_raw is null then 0 else
        case
          when i.title ilike sa.q_raw then 0
          when i.title ilike sa.q_raw || '%' then 1
          when char_length(sa.q_plain) >= 3 and i.title ilike '%' || sa.q_raw || '%' then 2
          when sa.q_fold is not null and i.title_fold = sa.q_fold then 3
          when sq.qa_raw  is not null and i.search_tsv      @@ sq.qa_raw  then 4
          when sq.qa_fold is not null and i.search_fold_tsv @@ sq.qa_fold then 5
          when sq.qa_sq   is not null and i.search_fold_tsv @@ sq.qa_sq   then 6
          when sq.qa_syn  is not null and i.search_fold_tsv @@ sq.qa_syn  then 7
          when (char_length(sa.q_plain) >= 3 and i.description ilike '%' || sa.q_raw || '%')
            or (sq.q_raw_tsq  is not null and i.search_tsv      @@ sq.q_raw_tsq)
            or (sq.q_fold_tsq is not null and i.search_fold_tsv @@ sq.q_fold_tsq)
            or (sq.q_syn_tsq  is not null and i.search_fold_tsv @@ sq.q_syn_tsq)
            or (sq.q_sq_tsq   is not null and i.search_fold_tsv @@ sq.q_sq_tsq) then 8
          when sq.q_any_tsq is not null and i.search_fold_tsv @@ sq.q_any_tsq then 9
          else 10
        end
      end as tier
    ) t
    -- joined ONCE (a function scan of the tiny active paid set), not per row;
    -- the tier now belongs to the listing, not to its owner
    left join (select v.item_id, v.tier, v.feed_boost_hours, v.starts_at, v.price_tjs from public.active_item_tiers() v) vip
      on vip.item_id = i.id
    where
      (i.status is null or i.status <> 'deleted')
      -- p_user_id narrows to one user's listings. Only that user themself sees
      -- all of their own (RLS additionally hides pending/rejected from anyone
      -- else); everyone else gets the public rule: approved and unresolved.
      and ($4 is null or i.user_id = $4)
      and (
        ($4 is not null and $4 = sa.me)
        or (i.moderation_status = 'approved' and (i.is_resolved = false or i.is_resolved is null))
      )
      and ($2 is null or $2 = 'All' or i.category = $2)
      and ($3 is null or i.type::text = $3)
      and (
        sa.q_raw is null
        or i.title ilike sa.q_raw || '%'
        or (sq.q_raw_tsq  is not null and i.search_tsv      @@ sq.q_raw_tsq)
        or (sq.q_fold_tsq is not null and i.search_fold_tsv @@ sq.q_fold_tsq)
        or (sq.q_syn_tsq  is not null and i.search_fold_tsv @@ sq.q_syn_tsq)
        or (sq.q_sq_tsq   is not null and i.search_fold_tsv @@ sq.q_sq_tsq)
        or (sq.q_any_tsq  is not null and i.search_fold_tsv @@ sq.q_any_tsq)
        or (char_length(sa.q_plain) >= 3 and (
              i.title ilike '%' || sa.q_raw || '%'
              or i.description ilike '%' || sa.q_raw || '%'
              or (char_length(sa.q_plain) <= 40 and (i.title % sa.q_plain or i.title_fold % sa.q_fold))))
      )
      and ($7 is null or i.created_at >= $7::date::timestamptz)
      and ($8 is null or i.created_at < ($8::date + 1)::timestamptz)
      and ($9 is null or ($9 = 'none' and i.location_type is null) or i.location_type = $9)
      and ($10 is null or i.city = $10)
    order by
      -- Browsing (no search text, not one user's own list): VVIP first,
      -- then VIPs by amount paid (more first), then newest purchase, then everyone else.
      -- With search text, relevance decides — a paid listing that does
      -- not match the query well must not jump over one that does.
      case when sa.q_raw is null and $4 is null then
        case vip.tier when 'vvip' then 0 when 'vip' then 1 else 2 end
      else 0 end asc,
      case when sa.q_raw is null and $4 is null then vip.price_tjs end desc nulls last,
      case when sa.q_raw is null and $4 is null then vip.starts_at end desc nulls last,
      t.tier asc,
      case when t.tier >= 9 then
        greatest(
          coalesce(ts_rank(i.search_fold_tsv, sq.q_any_tsq), 0),
          0.6 * coalesce(similarity(i.title, sa.q_plain), 0),
          0.6 * coalesce(similarity(i.title_fold, sa.q_fold), 0))
      else 0 end desc,
      i.date desc,
      (i.created_at + make_interval(hours => coalesce(vip.feed_boost_hours, 0))) desc,
      i.created_at desc,
      i.id
    limit least(greatest(coalesce($5, 20), 1), 200)
    offset greatest(coalesce($6, 0), 0)
  $q$ using p_search, p_category, p_type, p_user_id, p_limit, p_offset, p_date_from, p_date_to, p_location_type, p_city;
end;
$fn$;

-- A listing-level VIP ends with its listing; an account-wide VIP ends when
-- the owner has no live listing left (previous rule).
create or replace function public.release_vvip_when_no_live_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid := case when tg_op = 'DELETE' then old.id else new.id end;
  v_user text := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  v_live boolean;
  v_sub record;
begin
  v_live := tg_op <> 'DELETE'
    and (new.status is null or new.status <> 'deleted')
    and new.is_resolved is not true
    and new.moderation_status <> 'rejected';

  for v_sub in
    select s.id from public.subscriptions s
    where s.tier = 'vvip' and s.status = 'active' and s.expires_at > now()
      and (
        (s.item_id = v_item_id and not v_live)
        or (s.item_id is null and s.user_id = v_user and not exists (
              select 1 from public.items i
              where i.user_id = v_user
                and (i.status is null or i.status <> 'deleted')
                and i.is_resolved is not true
                and i.moderation_status <> 'rejected'))
      )
  loop
    update public.subscriptions set status = 'expired', updated_at = now() where id = v_sub.id;
    insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id, metadata)
    values (v_sub.id, v_user, 'expired', 'system', null, jsonb_build_object('reason', 'no_live_items'));
  end loop;
  return null;
end;
$$;

-- Data repair: link the live plans to the listings they were bought with
-- (each subscription row was created within ~2 s after its listing) and
-- restore the VIP that the old per-user "supersede" expired.
update public.subscriptions s
set item_id = x.item_id
from (
  select s2.id as sub_id,
         (select i.id from public.items i
          where i.user_id = s2.user_id
            and i.created_at <= s2.created_at
            and i.created_at > s2.created_at - interval '10 seconds'
          order by i.created_at desc limit 1) as item_id
  from public.subscriptions s2
  where s2.item_id is null and s2.created_at > '2026-09-24 09:00+00'
) x
where s.id = x.sub_id and x.item_id is not null;

update public.subscriptions s
set status = 'active', updated_at = now()
where s.status = 'expired'
  and s.item_id is not null
  and s.expires_at > now()
  and exists (
    select 1 from public.subscription_events e
    where e.subscription_id = s.id and e.event_type = 'expired' and e.metadata->>'reason' = 'superseded'
  )
  and not exists (
    select 1 from public.subscriptions o
    where o.id <> s.id and o.status = 'active' and o.item_id is not distinct from s.item_id
  );

notify pgrst, 'reload schema';

commit;
