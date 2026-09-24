import { describe, it, expect, vi, beforeEach } from 'vitest';

// SECURITY GAP FOUND (audit): app/api/items/moderate/route.ts had no auth
// check — anyone who found the URL could trigger a paid OpenAI call. These
// tests cover the fix directly: the auth-gating behavior, not just that the
// happy path still works (per docs/engineering/10-testing-rules.md).

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

const invokeMock = vi.fn();
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { functions: { invoke: (...args: unknown[]) => invokeMock(...args) } },
}));

describe('POST /api/items/moderate', () => {
  beforeEach(() => {
    authMock.mockReset();
    invokeMock.mockReset();
  });

  it('returns 401 and never calls ai-brain when there is no signed-in user', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { POST } = await import('@/app/api/items/moderate/route');

    const res = await POST(new Request('http://localhost/api/items/moderate', { method: 'POST', body: new FormData() }));

    expect(res.status).toBe(401);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('forwards to ai-brain when the caller is signed in', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' });
    invokeMock.mockResolvedValue({ data: { is_safe: true }, error: null });
    const { POST } = await import('@/app/api/items/moderate/route');

    const res = await POST(new Request('http://localhost/api/items/moderate', { method: 'POST', body: new FormData() }));

    expect(res.status).toBe(200);
    expect(invokeMock).toHaveBeenCalledWith('ai-brain', expect.any(Object));
  });
});
