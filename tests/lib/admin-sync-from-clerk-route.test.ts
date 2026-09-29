import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));
vi.mock('@/lib/admin-auth', () => ({ isAdminUser: (id: string | null) => id === 'admin_1' }));

const syncMock = vi.fn();
vi.mock('@/lib/services/profile-sync', () => ({
  syncProfileFromClerk: (...args: unknown[]) => syncMock(...args),
}));

const rows = [
  { id: 'u1', status: 'active' },
  { id: 'u2', status: 'deleted' },
];
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ or: () => ({ limit: async () => ({ data: rows, error: null }) }) }) }),
  },
}));

describe('POST /api/admin/users/sync-from-clerk', () => {
  beforeEach(() => {
    authMock.mockReset();
    syncMock.mockReset();
  });

  it('is a 404 for non-admins and touches nothing', async () => {
    authMock.mockResolvedValue({ userId: 'user_x' });
    const { POST } = await import('@/app/api/admin/users/sync-from-clerk/route');
    const res = await POST();
    expect(res.status).toBe(404);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it('syncs non-deleted profiles for an admin', async () => {
    authMock.mockResolvedValue({ userId: 'admin_1' });
    syncMock.mockResolvedValue({ created: false, filled: ['email'] });
    const { POST } = await import('@/app/api/admin/users/sync-from-clerk/route');
    const res = await POST();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(syncMock).toHaveBeenCalledWith('u1');
    expect(body).toMatchObject({ updated: 1, fieldCounts: { email: 1 } });
  });
});
