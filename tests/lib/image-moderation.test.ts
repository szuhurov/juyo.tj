import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summarizeModeration, reasonText, type ImageModeration } from '@/lib/image-moderation';

const m = (decision: ImageModeration['decision'], reasons: string[] = [], source: ImageModeration['source'] = 'admin'): { moderation: ImageModeration[] } => ({
  moderation: [{ decision, reasons, source }],
});

describe('summarizeModeration', () => {
  it('is the worst photo: block > review > safe', () => {
    expect(summarizeModeration([m('safe'), m('review', ['blade']), m('block', ['firearm'])]).decision).toBe('block');
    expect(summarizeModeration([m('safe'), m('review', ['blade'])])).toMatchObject({ decision: 'review', reasons: ['blade'] });
    expect(summarizeModeration([m('safe'), m('safe')]).decision).toBe('safe');
  });

  it('a photo without a score makes the listing unchecked, never safe', () => {
    expect(summarizeModeration([m('safe'), { moderation: [] }]).decision).toBe('unchecked');
    expect(summarizeModeration([]).decision).toBe('unchecked');
  });

  it('a flag on one photo still shows when another photo has no score', () => {
    expect(summarizeModeration([m('review', ['firearm']), { moderation: [] }]).decision).toBe('review');
  });

  it('admin-checked only when every score comes from the admin browser', () => {
    expect(summarizeModeration([m('safe'), m('safe', [], 'author')]).adminChecked).toBe(false);
    expect(summarizeModeration([m('safe'), m('safe', [], 'backfill')]).adminChecked).toBe(true);
  });

  it('plain reason labels', () => {
    expect(reasonText(['firearm', 'blade'])).toBe('Силоҳ?, Корд?');
  });
});

// ── routes: auth model + input validation ────────────────────────────────
const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));
vi.mock('@/lib/admin-auth', () => ({ isAdminUser: (id: string | null) => id === 'admin_1' }));
const rpcMock = vi.fn();
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { rpc: (...a: unknown[]) => rpcMock(...a), from: () => ({ select: () => ({ in: async () => ({ data: [], error: null }) }) }) } }));

const req = (body: unknown) => new Request('http://x/api/admin/posts/bulk-approve', { method: 'POST', body: JSON.stringify(body) }) as never;
const ID = '0f9486dd-e335-4c87-8c85-5281e3dbc80d';

describe('POST /api/admin/posts/bulk-approve', () => {
  beforeEach(() => { authMock.mockReset(); rpcMock.mockReset(); });

  it('is a 404 for non-admins and never reaches the database', async () => {
    authMock.mockResolvedValue({ userId: 'user_x' });
    const { POST } = await import('@/app/api/admin/posts/bulk-approve/route');
    expect((await POST(req({ items: [{ id: ID, updated_at: new Date().toISOString() }] }))).status).toBe(404);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects malformed or oversized input', async () => {
    authMock.mockResolvedValue({ userId: 'admin_1' });
    const { POST } = await import('@/app/api/admin/posts/bulk-approve/route');
    for (const body of [{}, { items: [] }, { items: [{ id: 'x', updated_at: 'now' }] }, { items: Array.from({ length: 51 }, () => ({ id: ID, updated_at: '2026-10-07T00:00:00Z' })) }]) {
      expect((await POST(req(body))).status).toBe(400);
    }
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('lets the database decide and reports what was approved; the admin id is recorded', async () => {
    authMock.mockResolvedValue({ userId: 'admin_1' });
    rpcMock.mockResolvedValue({ data: [ID], error: null });
    const { POST } = await import('@/app/api/admin/posts/bulk-approve/route');
    const res = await POST(req({ items: [{ id: ID, updated_at: '2026-10-07T10:00:00.123Z' }] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ approved: [ID] });
    expect(rpcMock).toHaveBeenCalledWith('admin_bulk_approve', { p_items: [{ id: ID, updated_at: '2026-10-07T10:00:00.123Z' }], p_admin: 'admin_1' });
  });
});

describe('GET /api/admin/posts/safe', () => {
  beforeEach(() => { authMock.mockReset(); rpcMock.mockReset(); });

  it('is a 404 for non-admins', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { GET } = await import('@/app/api/admin/posts/safe/route');
    expect((await GET()).status).toBe(404);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('returns an empty list when nothing is safe', async () => {
    authMock.mockResolvedValue({ userId: 'admin_1' });
    rpcMock.mockResolvedValue({ data: [], error: null });
    const { GET } = await import('@/app/api/admin/posts/safe/route');
    expect(await (await GET()).json()).toEqual({ posts: [] });
  });
});
