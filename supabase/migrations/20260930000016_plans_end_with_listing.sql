-- ============================================================================
-- A listing's TOP / VIP ends with the listing.
--
-- Bug (found right after 20260930000015): subscriptions.item_id is
-- "on delete set null", so hard-deleting a listing turned its TOP into an
-- account-wide plan (item_id null = applies to ALL the owner's listings) —
-- every other listing of that user suddenly showed TOP. Only VIP had an
-- end-with-listing rule, and it ran AFTER the FK had already nulled
-- item_id.
--
-- Now release_vvip_when_no_live_items (name kept, triggers unchanged
-- except timing) ends EVERY active or pending listing-level plan, any
-- tier, when its listing is deleted (hard or soft), resolved or rejected.
-- The delete trigger runs BEFORE DELETE, while item_id still points at the
-- row. Account-wide VIP keeps its rule (ends when the owner has no live
-- listing left).
--
-- Data repair: the TOP whose listing was hard-deleted today (now an
-- accidental account-wide plan) is expired.
--
-- Rollback: re-run the release function + triggers from
-- 20260930000015_plans_per_listing.sql / 20260930000011_vvip_first_and_release.sql.
-- ============================================================================

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

  if not v_live then
    for v_sub in
      select s.id, s.status from public.subscriptions s
      where s.item_id = v_item_id and s.status in ('active', 'pending')
    loop
      update public.subscriptions
      set status = case when v_sub.status = 'pending' then 'cancelled' else 'expired' end,
          updated_at = now()
      where id = v_sub.id;
      insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id, metadata)
      values (v_sub.id, v_user,
              case when v_sub.status = 'pending' then 'cancelled' else 'expired' end,
              'system', null, jsonb_build_object('reason', 'listing_ended'));
    end loop;

    -- account-wide VIP: ends when the owner has no other live listing
    for v_sub in
      select s.id from public.subscriptions s
      where s.item_id is null and s.user_id = v_user
        and s.tier = 'vvip' and s.status = 'active' and s.expires_at > now()
        and not exists (
          select 1 from public.items i
          where i.user_id = v_user and i.id <> v_item_id
            and (i.status is null or i.status <> 'deleted')
            and i.is_resolved is not true
            and i.moderation_status <> 'rejected')
    loop
      update public.subscriptions set status = 'expired', updated_at = now() where id = v_sub.id;
      insert into public.subscription_events (subscription_id, user_id, event_type, actor_type, actor_id, metadata)
      values (v_sub.id, v_user, 'expired', 'system', null, jsonb_build_object('reason', 'no_live_items'));
    end loop;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return null;
end;
$$;

revoke all on function public.release_vvip_when_no_live_items() from public, anon, authenticated;

-- BEFORE DELETE: item_id must still point at the row (the FK nulls it
-- afterwards).
drop trigger if exists trg_release_vvip_on_item_delete on public.items;
create trigger trg_release_vvip_on_item_delete
  before delete on public.items
  for each row
  execute function public.release_vvip_when_no_live_items();

-- Data repair: a plan that was bought for a listing (created right after it)
-- but whose listing is gone now has item_id null and acts account-wide.
update public.subscriptions s
set status = 'expired', updated_at = now()
where s.status = 'active' and s.item_id is null
  and s.id = '7d1b657d-92e1-4d8f-8cb6-b3506b126d4a';

notify pgrst, 'reload schema';
