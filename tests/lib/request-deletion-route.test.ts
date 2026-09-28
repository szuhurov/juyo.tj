import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Public, unauthenticated endpoint (audit finding): repeats for the same
// email must not keep filling the admin queue, and the response must not
// reveal whether a pending request already exists.

let pendingCount = 0;
const insertMock = vi.fn();
const eqCalls: [string, unknown][] = [];

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: () => {
      const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          eqCalls.push([col, val]);
          return chain;
        },
        then: (resolve: (v: unknown) => void) => resolve({ count: pendingCount, error: null }),
        insert: (row: unknown) => {
          insertMock(row);
          return Promise.resolve({ error: null });
        },
      };
      return chain;
    },
  },
}));

function post(body: unknown) {
  return new NextRequest('http://localhost/api/account/request-deletion', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/account/request-deletion', () => {
  beforeEach(() => {
    pendingCount = 0;
    insertMock.mockReset();
    eqCalls.length = 0;
  });

  it('rejects an invalid email without touching the database', async () => {
    const { POST } = await import('@/app/api/account/request-deletion/route');
    const res = await POST(post({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('stores a normalized email when no pending request exists', async () => {
    const { POST } = await import('@/app/api/account/request-deletion/route');
    const res = await POST(post({ email: '  User@Example.COM ', note: 'hi' }));
    expect(res.status).toBe(200);
    expect(eqCalls).toContainEqual(['email', 'user@example.com']);
    expect(insertMock).toHaveBeenCalledWith({ email: 'user@example.com', note: 'hi' });
  });

  it('does not insert a duplicate but still answers ok', async () => {
    pendingCount = 1;
    const { POST } = await import('@/app/api/account/request-deletion/route');
    const res = await POST(post({ email: 'user@example.com' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
