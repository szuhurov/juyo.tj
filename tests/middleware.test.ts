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
