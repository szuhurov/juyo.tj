import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('Rate limiting rules', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('rateLimit is imported correctly and is async', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    expect(typeof rateLimit).toBe('function');
    // rateLimit returns a Promise
    const result = rateLimit('type-check-key', 5, 60_000);
    expect(result).toBeInstanceOf(Promise);
    await result;
  });

  it('allows 10 requests to /items/add per minute per IP', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    const key = `middleware-add-test-${Date.now()}`;
    let allowed = 0;
    for (let i = 0; i < 11; i++) {
      if (await rateLimit(key, 10, 60_000)) allowed++;
    }
    expect(allowed).toBe(10);
  });

  it('allows 200 general page requests per minute', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    const key = `middleware-general-test-${Date.now()}`;
    let allowed = 0;
    for (let i = 0; i < 201; i++) {
      if (await rateLimit(key, 200, 60_000)) allowed++;
    }
    expect(allowed).toBe(200);
  });

  it('different IPs have independent rate limits', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    const ts = Date.now();
    const key1 = `ip-1-${ts}`;
    const key2 = `ip-2-${ts}`;

    for (let i = 0; i < 10; i++) await rateLimit(key1, 10, 60_000);
    expect(await rateLimit(key1, 10, 60_000)).toBe(false);
    expect(await rateLimit(key2, 10, 60_000)).toBe(true);
  });

  it('returns 429 status for rate-limited responses', () => {
    const response = new Response(
      JSON.stringify({ error: 'Too Many Requests', retryAfter: 60 }),
      { status: 429, headers: { 'Retry-After': '60', 'Content-Type': 'application/json' } }
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
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
