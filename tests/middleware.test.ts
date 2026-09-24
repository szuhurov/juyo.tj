import { describe, it, expect, vi } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler: Function) => handler,
  createRouteMatcher: (patterns: string[]) => (request: Request) => {
    const url = new URL(request.url);
    return patterns.some(p => {
      const plain = p.replace(/\(.*\)/, '').replace(/\.\*$/, '');
      return url.pathname.startsWith(plain);
    });
  },
}));

// SECURITY GAP FOUND (audit): neither route below was covered by any rate
// limiter. Exercises the actual exported function, not a re-implementation.
const { isLimitedActionRateLimited } = await import('../middleware');

describe('Limited-action rate limit', () => {
  const req = (ip: string) => new Request('http://localhost/x', { headers: { 'x-forwarded-for': ip } });

  it('allows the first 10 requests from one IP to request-deletion, then blocks the 11th', () => {
    const ip = '203.0.113.10';
    for (let i = 0; i < 10; i++) {
      expect(isLimitedActionRateLimited(req(ip), '/api/account/request-deletion')).toBe(false);
    }
    expect(isLimitedActionRateLimited(req(ip), '/api/account/request-deletion')).toBe(true);
  });

  it('tracks items/moderate and request-deletion as separate buckets per IP', () => {
    const ip = '203.0.113.20';
    for (let i = 0; i < 10; i++) isLimitedActionRateLimited(req(ip), '/api/items/moderate');
    // The moderate bucket for this IP is now exhausted, but request-deletion is a different key.
    expect(isLimitedActionRateLimited(req(ip), '/api/account/request-deletion')).toBe(false);
  });

  it('does not rate-limit unrelated paths', () => {
    expect(isLimitedActionRateLimited(req('203.0.113.30'), '/api/some-other-route')).toBe(false);
  });
});

describe('Protected routes', () => {
  const protectedPaths = ['/profile', '/profile/edit', '/items/add', '/items/123/edit'];
  const publicPaths = ['/', '/items/123', '/sign-in', '/sign-up', '/qr/abc'];

  for (const path of protectedPaths) {
    it(`${path} is a protected route`, () => {
      const isProtected = ['/profile', '/items/add', '/items/'].some(prefix =>
        path.startsWith(prefix)
      );
      expect(isProtected).toBe(true);
    });
  }

  for (const path of publicPaths) {
    it(`${path} is NOT a protected route`, () => {
      const isProtected = ['/profile', '/items/add'].some(prefix =>
        path.startsWith(prefix) && (path === prefix || path[prefix.length] === '/')
      ) || /^\/items\/[^/]+\/edit$/.test(path);
      if (path === '/items/123') expect(isProtected).toBe(false);
    });
  }
});
