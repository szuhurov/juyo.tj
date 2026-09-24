import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 7A — an organization must never be silently orphaned because its
// owner deleted their personal account. These tests cover that block
// directly (per docs/engineering/10-testing-rules.md: auth/authorization
// gating gets its own coverage, not just the happy path).

const deleteUserMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({ users: { deleteUser: deleteUserMock } }),
}));

// A minimal chainable mock: `.from(table)` returns a fresh chain each call,
// and every builder method returns `this` so `.select().eq().in()` etc. all
// work regardless of call shape — the chain itself resolves when awaited.
function makeChain(result: { data: any; error: any }) {
  const chain: any = {};
  for (const m of ['select', 'eq', 'in', 'insert', 'delete', 'remove']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: Function, reject?: Function) => Promise.resolve(result).then(resolve as any, reject as any);
  return chain;
}

const fromMock = vi.fn();
const removeMock = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => fromMock(...args),
    storage: { from: () => ({ remove: removeMock }) },
  },
}));

describe('deleteUserAccount — organization ownership block', () => {
  beforeEach(() => {
    deleteUserMock.mockReset();
    fromMock.mockReset();
    removeMock.mockClear();
  });

  it('throws OrganizationOwnershipBlockedError and never touches Clerk when the user owns an active organization', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return makeChain({ data: [{ name: 'Hotel Somoni' }], error: null });
      }
      throw new Error(`unexpected table access: ${table}`);
    });

    const { deleteUserAccount, OrganizationOwnershipBlockedError } = await import('@/lib/services/account-deletion');

    await expect(deleteUserAccount('user_owner')).rejects.toBeInstanceOf(OrganizationOwnershipBlockedError);
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it('includes every blocking organization name in the error, for multiple owned orgs', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return makeChain({ data: [{ name: 'Hotel Somoni' }, { name: 'Cafe Rudaki' }], error: null });
      }
      throw new Error(`unexpected table access: ${table}`);
    });

    const { deleteUserAccount, OrganizationOwnershipBlockedError } = await import('@/lib/services/account-deletion');

    try {
      await deleteUserAccount('user_owner');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(OrganizationOwnershipBlockedError);
      expect((err as InstanceType<typeof OrganizationOwnershipBlockedError>).organizationNames).toEqual([
        'Hotel Somoni',
        'Cafe Rudaki',
      ]);
    }
  });

  it('proceeds past the check (reaches the profile lookup) when the user owns no organizations', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'organizations') return makeChain({ data: [], error: null });
      if (table === 'profiles') return makeChain({ data: null, error: null }); // no profile → early { ok: true } return
      throw new Error(`unexpected table access: ${table}`);
    });

    const { deleteUserAccount } = await import('@/lib/services/account-deletion');

    const result = await deleteUserAccount('user_no_orgs');
    expect(result).toEqual({ ok: true });
    expect(deleteUserMock).not.toHaveBeenCalled(); // no profile row → returns before Clerk deletion, unrelated to the org check
  });
});
