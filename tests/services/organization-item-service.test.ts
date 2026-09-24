import { describe, it, expect, vi } from 'vitest';
import { OrganizationItemService } from '@/lib/services/organization-item-service';
import type { SupabaseClient } from '@supabase/supabase-js';

const makeMockClient = (rpcResult?: { data: any; error: any }) =>
  ({
    rpc: vi.fn().mockResolvedValue(rpcResult ?? { data: null, error: null }),
  }) as unknown as SupabaseClient;

describe('OrganizationItemService.getCompatibleOrganizations', () => {
  it('calls get_compatible_organizations with location type and optional city', async () => {
    const client = makeMockClient({ data: [{ id: 'org-1', name: 'Somon Taxi', category: 'transport' }], error: null });
    const orgs = await OrganizationItemService.getCompatibleOrganizations('taxi', 'dushanbe', client);
    expect(client.rpc).toHaveBeenCalledWith('get_compatible_organizations', { p_location_type: 'taxi', p_city: 'dushanbe' });
    expect(orgs).toEqual([{ id: 'org-1', name: 'Somon Taxi', category: 'transport' }]);
  });

  it('sends null city when omitted — the server filters by place-type compatibility only', async () => {
    const client = makeMockClient({ data: [], error: null });
    await OrganizationItemService.getCompatibleOrganizations('bank', undefined, client);
    expect(client.rpc).toHaveBeenCalledWith('get_compatible_organizations', { p_location_type: 'bank', p_city: null });
  });
});

describe('OrganizationItemService.getOrganizationBranchesForPicker', () => {
  it('calls get_organization_branches_for_picker with the organization id', async () => {
    const client = makeMockClient({ data: [{ id: 'branch-1', name: 'Dushanbe', city: 'dushanbe' }], error: null });
    const branches = await OrganizationItemService.getOrganizationBranchesForPicker('org-1', undefined, client);
    expect(client.rpc).toHaveBeenCalledWith('get_organization_branches_for_picker', { p_organization_id: 'org-1', p_city: null });
    expect(branches[0].id).toBe('branch-1');
  });
});

describe('OrganizationItemService.getReviewQueue', () => {
  it('calls get_organization_review_queue and maps rows to camelCase', async () => {
    const client = makeMockClient({
      data: [{
        item_id: 'item-1', title: 'Lost phone', category: 'Phone', type: 'lost', city: 'dushanbe',
        branch_id: 'branch-1', is_organization_owned: false, created_at: '2026-09-29T00:00:00.000Z',
      }],
      error: null,
    });
    const queue = await OrganizationItemService.getReviewQueue('org-1', undefined, client);
    expect(client.rpc).toHaveBeenCalledWith('get_organization_review_queue', { p_organization_id: 'org-1', p_branch_id: null });
    expect(queue[0]).toEqual({
      itemId: 'item-1', title: 'Lost phone', category: 'Phone', type: 'lost', city: 'dushanbe',
      branchId: 'branch-1', isOrganizationOwned: false, createdAt: '2026-09-29T00:00:00.000Z',
    });
  });
});

describe('OrganizationItemService.approvePost / rejectPost', () => {
  it('approvePost calls approve_organization_post with only the item id', async () => {
    const client = makeMockClient();
    await OrganizationItemService.approvePost('item-1', client);
    expect(client.rpc).toHaveBeenCalledWith('approve_organization_post', { p_item_id: 'item-1' });
  });

  it('rejectPost calls reject_organization_post with the item id and optional reason', async () => {
    const client = makeMockClient();
    await OrganizationItemService.rejectPost('item-1', 'Not related to our branch', client);
    expect(client.rpc).toHaveBeenCalledWith('reject_organization_post', { p_item_id: 'item-1', p_reason: 'Not related to our branch' });
  });

  it('propagates a rejection error (e.g. unauthorized caller, cross-branch)', async () => {
    const client = makeMockClient({ data: null, error: { message: 'Not authorized for this branch' } });
    await expect(OrganizationItemService.approvePost('item-1', client)).rejects.toBeTruthy();
  });
});

describe('OrganizationItemService.createOrganizationFoundItem', () => {
  it('sends the full org-item payload — organization is the tenant, never a personal user_id', async () => {
    const client = makeMockClient({ data: 'new-item-id', error: null });
    const id = await OrganizationItemService.createOrganizationFoundItem(
      {
        organizationId: 'org-1', branchId: 'branch-1', title: 'Found wallet', description: 'Black leather wallet',
        category: 'Wallet', date: '2026-09-29', city: 'dushanbe', locationType: 'taxi', imageUrls: ['https://x/1.jpg'],
      },
      client,
    );
    expect(client.rpc).toHaveBeenCalledWith('create_organization_found_item', {
      p_organization_id: 'org-1', p_branch_id: 'branch-1', p_title: 'Found wallet', p_description: 'Black leather wallet',
      p_category: 'Wallet', p_date: '2026-09-29', p_city: 'dushanbe', p_location_type: 'taxi', p_reward: null,
      p_image_urls: ['https://x/1.jpg'],
    });
    expect(id).toBe('new-item-id');
  });

  it('defaults optional fields to null/empty array rather than inventing values', async () => {
    const client = makeMockClient({ data: 'new-item-id', error: null });
    await OrganizationItemService.createOrganizationFoundItem(
      { organizationId: 'org-1', branchId: 'branch-1', title: 'Found keys', description: '', category: 'Keys', date: '2026-09-29', city: 'dushanbe' },
      client,
    );
    expect(client.rpc).toHaveBeenCalledWith('create_organization_found_item', expect.objectContaining({
      p_location_type: null, p_reward: null, p_image_urls: [],
    }));
  });

  it('throws when the RPC rejects (e.g. caller lacks staff+ role in the branch)', async () => {
    const client = makeMockClient({ data: null, error: { message: 'Not authorized' } });
    await expect(
      OrganizationItemService.createOrganizationFoundItem(
        { organizationId: 'org-1', branchId: 'branch-1', title: 'Found keys', description: '', category: 'Keys', date: '2026-09-29', city: 'dushanbe' },
        client,
      ),
    ).rejects.toBeTruthy();
  });
});
