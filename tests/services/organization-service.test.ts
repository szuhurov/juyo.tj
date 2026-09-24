import { describe, it, expect, vi } from 'vitest';
import { OrganizationService } from '@/lib/services/organization-service';
import type { SupabaseClient } from '@supabase/supabase-js';

const makeMockClient = (rpcResult: { data: any; error: any }) =>
  ({
    rpc: vi.fn().mockResolvedValue(rpcResult),
  }) as unknown as SupabaseClient;

describe('OrganizationService.createOrganization', () => {
  it('sends only name/category — never a role, status, or owner id', async () => {
    const client = makeMockClient({ data: 'org-1', error: null });
    const id = await OrganizationService.createOrganization('Hotel Somoni', 'hotel', client);
    expect(client.rpc).toHaveBeenCalledWith('create_organization', { p_name: 'Hotel Somoni', p_category: 'hotel' });
    expect(id).toBe('org-1');
  });

  it('throws on error', async () => {
    const client = makeMockClient({ data: null, error: { message: 'boom' } });
    await expect(OrganizationService.createOrganization('X', 'hotel', client)).rejects.toBeTruthy();
  });
});

describe('OrganizationService.getMyOrganizations', () => {
  it('maps rows to camelCase, including role and branch scope', async () => {
    const client = makeMockClient({
      data: [{ organization_id: 'org-1', name: 'Hotel Somoni', category: 'hotel', status: 'active', role: 'owner', branch_id: null }],
      error: null,
    });
    const orgs = await OrganizationService.getMyOrganizations(client);
    expect(orgs).toEqual([
      { organizationId: 'org-1', name: 'Hotel Somoni', category: 'hotel', status: 'active', role: 'owner', branchId: null },
    ]);
  });

  it('returns an empty array when the RPC returns null', async () => {
    const client = makeMockClient({ data: null, error: null });
    expect(await OrganizationService.getMyOrganizations(client)).toEqual([]);
  });
});

describe('OrganizationService.getOrganization', () => {
  it('returns null when the org is not visible to the caller', async () => {
    const client = makeMockClient({ data: [], error: null });
    expect(await OrganizationService.getOrganization('org-1', client)).toBeNull();
  });

  it('maps the single row when visible', async () => {
    const client = makeMockClient({
      data: [{ id: 'org-1', name: 'Hotel Somoni', category: 'hotel', status: 'active', verification_status: 'unverified', default_branch_id: 'branch-1', created_at: '2026-09-26T00:00:00.000Z' }],
      error: null,
    });
    const org = await OrganizationService.getOrganization('org-1', client);
    expect(org?.verificationStatus).toBe('unverified');
    expect(org?.defaultBranchId).toBe('branch-1');
  });
});

describe('OrganizationService.changeMemberRole', () => {
  // Note: OrganizationService.changeMemberRole's `newRole` param type is
  // `Exclude<OrganizationRole, "owner">` — 'owner' can't even be passed
  // from this file without a type error, verified by `tsc --noEmit`
  // (checked separately, not re-asserted at runtime here). Ownership only
  // ever moves via transferOwnership, never this method.

  it('calls change_member_role with exactly the given params, no extra role/permission fields', async () => {
    const client = makeMockClient({ data: null, error: null });
    await OrganizationService.changeMemberRole('org-1', 'member-1', 'branch_manager', 'branch-1', client);
    expect(client.rpc).toHaveBeenCalledWith('change_member_role', {
      p_organization_id: 'org-1',
      p_member_id: 'member-1',
      p_new_role: 'branch_manager',
      p_branch_id: 'branch-1',
    });
  });
});

describe('OrganizationService.transferOwnership', () => {
  it('calls transfer_organization_ownership with the target user id', async () => {
    const client = makeMockClient({ data: null, error: null });
    await OrganizationService.transferOwnership('org-1', 'user_new_owner', client);
    expect(client.rpc).toHaveBeenCalledWith('transfer_organization_ownership', {
      p_organization_id: 'org-1',
      p_new_owner_user_id: 'user_new_owner',
    });
  });
});

describe('OrganizationService.archiveOrganization', () => {
  it('calls archive_organization with only the organization id', async () => {
    const client = makeMockClient({ data: null, error: null });
    await OrganizationService.archiveOrganization('org-1', client);
    expect(client.rpc).toHaveBeenCalledWith('archive_organization', { p_organization_id: 'org-1' });
  });
});

describe('OrganizationService.createBranch / updateBranch / archiveBranch', () => {
  it('createBranch passes city/address as null when omitted, never invents defaults', async () => {
    const client = makeMockClient({ data: 'branch-2', error: null });
    await OrganizationService.createBranch('org-1', 'Khujand Branch', undefined, undefined, client);
    expect(client.rpc).toHaveBeenCalledWith('create_branch', {
      p_organization_id: 'org-1',
      p_name: 'Khujand Branch',
      p_city: null,
      p_address: null,
    });
  });

  it('archiveBranch calls archive_branch with the branch id and no reassignment target when omitted', async () => {
    const client = makeMockClient({ data: null, error: null });
    await OrganizationService.archiveBranch('branch-1', undefined, client);
    expect(client.rpc).toHaveBeenCalledWith('archive_branch', { p_branch_id: 'branch-1', p_reassign_members_to: null });
  });

  it('archiveBranch passes a reassignment target when the branch has active members (Phase 7B)', async () => {
    const client = makeMockClient({ data: null, error: null });
    await OrganizationService.archiveBranch('branch-1', 'branch-2', client);
    expect(client.rpc).toHaveBeenCalledWith('archive_branch', { p_branch_id: 'branch-1', p_reassign_members_to: 'branch-2' });
  });
});

describe('OrganizationService.getOrgBranches', () => {
  it('calls get_org_branches with the organization id and maps every branch regardless of status', async () => {
    const client = makeMockClient({
      data: [
        { id: 'branch-1', name: 'Dushanbe HQ', city: 'dushanbe', address: null, status: 'active', is_default: true, created_at: '2026-09-26T00:00:00.000Z' },
        { id: 'branch-2', name: 'Khujand Branch', city: 'khujand', address: 'Some street', status: 'archived', is_default: false, created_at: '2026-09-27T00:00:00.000Z' },
      ],
      error: null,
    });
    const branches = await OrganizationService.getOrgBranches('org-1', client);
    expect(client.rpc).toHaveBeenCalledWith('get_org_branches', { p_organization_id: 'org-1' });
    // Management listing must include the archived branch too — unlike
    // getOrganizationBranchesForPicker, which is active-only by design.
    expect(branches).toEqual([
      { id: 'branch-1', name: 'Dushanbe HQ', city: 'dushanbe', address: null, status: 'active', isDefault: true, createdAt: '2026-09-26T00:00:00.000Z' },
      { id: 'branch-2', name: 'Khujand Branch', city: 'khujand', address: 'Some street', status: 'archived', isDefault: false, createdAt: '2026-09-27T00:00:00.000Z' },
    ]);
  });

  it('propagates an error when the caller is not owner/admin', async () => {
    const client = makeMockClient({ data: null, error: { message: 'Not authorized' } });
    await expect(OrganizationService.getOrgBranches('org-1', client)).rejects.toBeTruthy();
  });
});

describe('OrganizationService.changeMemberBranch', () => {
  it('calls change_member_branch with org/member/target-branch ids only', async () => {
    const client = makeMockClient({ data: null, error: null });
    await OrganizationService.changeMemberBranch('org-1', 'member-1', 'branch-2', client);
    expect(client.rpc).toHaveBeenCalledWith('change_member_branch', {
      p_organization_id: 'org-1',
      p_member_id: 'member-1',
      p_new_branch_id: 'branch-2',
    });
  });
});

describe('OrganizationService.leaveOrganization', () => {
  it('calls leave_organization with only the organization id', async () => {
    const client = makeMockClient({ data: null, error: null });
    await OrganizationService.leaveOrganization('org-1', client);
    expect(client.rpc).toHaveBeenCalledWith('leave_organization', { p_organization_id: 'org-1' });
  });
});

describe('OrganizationService.inviteMember', () => {
  it('sends only organization/user/role/branch — never a status or expiry', async () => {
    const client = makeMockClient({ data: 'invitation-1', error: null });
    const id = await OrganizationService.inviteMember('org-1', 'user_invitee', 'staff', 'branch-1', client);
    expect(client.rpc).toHaveBeenCalledWith('invite_organization_member', {
      p_organization_id: 'org-1',
      p_invited_user_id: 'user_invitee',
      p_role: 'staff',
      p_branch_id: 'branch-1',
    });
    expect(id).toBe('invitation-1');
  });

  it('throws when the RPC rejects (e.g. duplicate pending invitation)', async () => {
    const client = makeMockClient({ data: null, error: { message: 'This user already has a pending invitation to this organization' } });
    await expect(OrganizationService.inviteMember('org-1', 'user_invitee', 'staff', 'branch-1', client)).rejects.toBeTruthy();
  });
});

describe('OrganizationService.getMyInvitations / getOrgInvitations', () => {
  it('maps get_my_invitations rows to camelCase, including the resolved org/branch names', async () => {
    const client = makeMockClient({
      data: [{
        id: 'inv-1', organization_id: 'org-1', organization_name: 'Hotel Somoni',
        branch_id: 'branch-1', branch_name: 'Dushanbe', role: 'staff',
        invited_by: 'user_admin', status: 'pending',
        expires_at: '2026-10-03T00:00:00.000Z', created_at: '2026-09-27T00:00:00.000Z',
      }],
      error: null,
    });
    const invitations = await OrganizationService.getMyInvitations(client);
    expect(invitations).toEqual([{
      id: 'inv-1', organizationId: 'org-1', organizationName: 'Hotel Somoni',
      branchId: 'branch-1', branchName: 'Dushanbe', role: 'staff',
      invitedBy: 'user_admin', status: 'pending',
      expiresAt: '2026-10-03T00:00:00.000Z', createdAt: '2026-09-27T00:00:00.000Z',
    }]);
  });

  it('getOrgInvitations calls get_org_invitations with the organization id', async () => {
    const client = makeMockClient({ data: [], error: null });
    await OrganizationService.getOrgInvitations('org-1', client);
    expect(client.rpc).toHaveBeenCalledWith('get_org_invitations', { p_organization_id: 'org-1' });
  });
});

describe('OrganizationService.acceptInvitation / rejectInvitation / revokeInvitation', () => {
  it('each calls its RPC with only the invitation id — no org/role/branch supplied by the client', async () => {
    const client = makeMockClient({ data: null, error: null });

    await OrganizationService.acceptInvitation('inv-1', client);
    expect(client.rpc).toHaveBeenCalledWith('accept_organization_invitation', { p_invitation_id: 'inv-1' });

    await OrganizationService.rejectInvitation('inv-1', client);
    expect(client.rpc).toHaveBeenCalledWith('reject_organization_invitation', { p_invitation_id: 'inv-1' });

    await OrganizationService.revokeInvitation('inv-1', client);
    expect(client.rpc).toHaveBeenCalledWith('revoke_invitation', { p_invitation_id: 'inv-1' });
  });

  it('propagates a rejection error (e.g. accepting an expired invitation)', async () => {
    const client = makeMockClient({ data: null, error: { message: 'Invitation no longer valid' } });
    await expect(OrganizationService.acceptInvitation('inv-1', client)).rejects.toBeTruthy();
  });
});
