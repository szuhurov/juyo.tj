-- ============================================================================
-- Phase 7 — Absolute Final Gap Closure: organization branch MANAGEMENT
-- read. Builds additively on 20260926000000/20260927000000/20260928000000/
-- 20260929000000 — none of those are altered.
--
-- Gap closed: get_organization_branches_for_picker (20260929000000) only
-- returns ACTIVE branches (correct for the post-creation picker use case —
-- an archived branch should never be selectable for a new post). A branch
-- MANAGEMENT screen (list to edit/archive) needs every branch regardless
-- of status, plus the address/is_default fields the picker deliberately
-- omits. Rather than widen the picker RPC's contract (which would leak
-- archived/inactive branches into the post-creation flow), this migration
-- adds a second, narrower RPC scoped to owner/admin only — the exact same
-- role rule create_branch/update_branch/archive_branch already enforce.
-- ============================================================================

create or replace function public.get_org_branches(p_organization_id uuid)
returns table (
  id uuid, name text, city text, address text, status text,
  is_default boolean, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := public.get_my_org_role(p_organization_id);
begin
  -- coalesce(v_role, '') — see the identical comment in create_branch
  -- (20260926000000): a NULL role (non-member) must fail this check, and
  -- without the coalesce a NULL IF-condition silently skips the raise.
  if coalesce(v_role, '') not in ('owner', 'admin') then
    raise exception 'Not authorized';
  end if;

  return query
  select b.id, b.name, b.city, b.address, b.status, b.is_default, b.created_at
  from public.organization_branches b
  where b.organization_id = p_organization_id
  order by b.is_default desc, b.status, b.name;
end;
$$;

grant execute on function public.get_org_branches(uuid) to authenticated;

-- ============================================================================
-- Rollback (not executed — reference only):
--
-- drop function if exists public.get_org_branches(uuid);
-- ============================================================================
