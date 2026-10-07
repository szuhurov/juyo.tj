-- Two public leaks found 2026-10-07 with nothing but the publishable key:
--
-- 1. items.phone_number of every listing was readable in one request.
--    20260824020000 revoked the COLUMN privilege, but anon keeps Supabase's
--    default TABLE-level SELECT, which covers every column — so the revoke
--    never took effect. Here anon loses the table-level grant and gets every
--    column back except the phone fields. The finder still sees a number
--    through get_item_phone() (one listing at a time).
--    Signed-in users keep table-level SELECT for now: their own edit screens
--    (build 5 included) select '*'. Closing that needs client changes first.
--
-- 2. Listings marked deleted stayed visible to everyone (text and photos):
--    items_select_visible only checked moderation_status. Now only the
--    owner sees them.
--
-- NOTE: a column added to items later is NOT visible to anon until it is
-- granted explicitly (grant select (new_col) on public.items to anon).

do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'items'
     and column_name not in ('phone_number', 'handoff_phone');
  execute 'revoke select on public.items from anon';
  execute format('grant select (%s) on public.items to anon', v_cols);
end;
$$;

drop policy if exists items_select_visible on public.items;
create policy items_select_visible on public.items
  for select
  using (
    (moderation_status = 'approved'::moderation_status and status is distinct from 'deleted' and deleted_at is null)
    or get_auth_id() = user_id
  );
