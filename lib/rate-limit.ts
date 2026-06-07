import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ── In-memory fallback (dev / single-instance) ────────────────────────────

interface RLWindow {
  count: number;
  resetAt: number;
}

const store = new Map<string, RLWindow>();

function cleanup() {
  const now = Date.now();
  for (const [key, win] of store) {
    if (now >= win.resetAt) store.delete(key);
  }
}

function rateLimitMemory(key: string, limit: number, windowMs: number): boolean {
  if (store.size > 10_000) cleanup();
  const now = Date.now();
  const win = store.get(key);
  if (!win || now >= win.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (win.count >= limit) return false;
  win.count += 1;
  return true;
}

// ── Upstash Redis (multi-instance production) ─────────────────────────────

const hasUpstash = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

let _redis: Redis | null = null;
const _limiters = new Map<string, Ratelimit>();

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit {
  if (!_redis) _redis = Redis.fromEnv();
  const cacheKey = `${limit}:${windowMs}`;
  if (!_limiters.has(cacheKey)) {
    _limiters.set(cacheKey, new Ratelimit({
      redis: _redis,
      limiter: Ratelimit.slidingWindow(limit, `${Math.ceil(windowMs / 1000)} s`),
      analytics: false,
      prefix: 'juyo',
    }));
  }
  return _limiters.get(cacheKey)!;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Returns true if the request is allowed, false if rate-limited.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are set; otherwise falls back to in-memory (single-instance / dev).
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (limit <= 0) return false;
  if (hasUpstash) {
    const { success } = await getUpstashLimiter(limit, windowMs).limit(key);
    return success;
  }
  return rateLimitMemory(key, limit, windowMs);
}

/**
 * Returns remaining requests and approximate reset time from the in-memory store.
 * When Upstash is active, use this only for header hints — Upstash tracks state server-side.
 */
export function rateLimitInfo(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const win = store.get(key);
  if (!win || now >= win.resetAt) return { remaining: limit, resetAt: now + windowMs };
  return { remaining: Math.max(0, limit - win.count), resetAt: win.resetAt };
}
