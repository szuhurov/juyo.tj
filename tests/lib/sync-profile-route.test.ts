import { describe, it, expect, vi, beforeEach } from 'vitest';

// New route: the app calls it after sign-in so an app-created profile still
// gets its email/name from Clerk. Auth-gating first (10-testing-rules.md).

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));

const syncMock = vi.fn();
vi.mock('@/lib/services/profile-sync', () => ({
  syncProfileFromClerk: (...args: unknown[]) => syncMock(...args),
}));

describe('POST /api/account/sync-profile', () => {
  beforeEach(() => {
    authMock.mockReset();
    syncMock.mockReset();
  });

  it('returns 401 and never syncs without a signed-in user', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { POST } = await import('@/app/api/account/sync-profile/route');
    const res = await POST();
    expect(res.status).toBe(401);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("syncs only the caller's own profile", async () => {
    authMock.mockResolvedValue({ userId: 'user_self' });
    syncMock.mockResolvedValue({ created: false, filled: ['email'] });
    const { POST } = await import('@/app/api/account/sync-profile/route');
    const res = await POST();
    expect(res.status).toBe(200);
    expect(syncMock).toHaveBeenCalledWith('user_self');
  });
});
