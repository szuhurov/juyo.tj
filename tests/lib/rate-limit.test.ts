import { describe, it, expect, beforeEach, vi } from 'vitest';

// Reset module store between tests for isolation
beforeEach(() => {
  vi.resetModules();
});

describe('rateLimit', () => {
  it('allows the first request', async () => {
    const { rateLimit: rl } = await import('@/lib/rate-limit');
    expect(await rl('test-key-1', 5, 60_000)).toBe(true);
  });

  it('allows requests up to the limit', async () => {
    const { rateLimit: rl } = await import('@/lib/rate-limit');
    const key = 'test-key-limit';
    const limit = 3;

    expect(await rl(key, limit, 60_000)).toBe(true);  // 1
    expect(await rl(key, limit, 60_000)).toBe(true);  // 2
    expect(await rl(key, limit, 60_000)).toBe(true);  // 3
    expect(await rl(key, limit, 60_000)).toBe(false); // 4 — blocked
    expect(await rl(key, limit, 60_000)).toBe(false); // 5 — blocked
  });

  it('resets after the window expires', async () => {
    vi.useFakeTimers();
    const { rateLimit: rl } = await import('@/lib/rate-limit');
    const key = 'test-key-reset';
    const windowMs = 1000;

    await rl(key, 1, windowMs); // use up the 1 request
    expect(await rl(key, 1, windowMs)).toBe(false); // blocked

    vi.advanceTimersByTime(windowMs + 1);
    expect(await rl(key, 1, windowMs)).toBe(true); // reset — allowed again

    vi.useRealTimers();
  });

  it('different keys are tracked independently', async () => {
    const { rateLimit: rl } = await import('@/lib/rate-limit');
    await rl('key-a', 1, 60_000);
    expect(await rl('key-a', 1, 60_000)).toBe(false); // key-a blocked
    expect(await rl('key-b', 1, 60_000)).toBe(true);  // key-b still allowed
  });

  it('returns false when limit is 0', async () => {
    const { rateLimit: rl } = await import('@/lib/rate-limit');
    expect(await rl('zero-limit', 0, 60_000)).toBe(false);
  });

  it('limit of 1 allows exactly one request per window', async () => {
    vi.useFakeTimers();
    const { rateLimit: rl } = await import('@/lib/rate-limit');
    const key = 'single-request';

    expect(await rl(key, 1, 5000)).toBe(true);
    expect(await rl(key, 1, 5000)).toBe(false);
    expect(await rl(key, 1, 5000)).toBe(false);

    vi.advanceTimersByTime(5001);
    expect(await rl(key, 1, 5000)).toBe(true);
    expect(await rl(key, 1, 5000)).toBe(false);

    vi.useRealTimers();
  });
});

describe('rateLimitInfo', () => {
  it('returns full remaining count for a fresh key', async () => {
    const { rateLimitInfo: rli } = await import('@/lib/rate-limit');
    const info = rli('info-key-fresh', 10, 60_000);
    expect(info.remaining).toBe(10);
    expect(info.resetAt).toBeGreaterThan(Date.now());
  });

  it('decrements remaining after rateLimit calls', async () => {
    const { rateLimit: rl, rateLimitInfo: rli } = await import('@/lib/rate-limit');
    const key = 'info-key-track';
    await rl(key, 5, 60_000); // 1
    await rl(key, 5, 60_000); // 2
    await rl(key, 5, 60_000); // 3

    const info = rli(key, 5, 60_000);
    expect(info.remaining).toBe(2); // 5 - 3
  });

  it('returns 0 remaining when limit is exhausted', async () => {
    const { rateLimit: rl, rateLimitInfo: rli } = await import('@/lib/rate-limit');
    const key = 'info-key-exhaust';
    for (let i = 0; i < 3; i++) await rl(key, 3, 60_000);

    const info = rli(key, 3, 60_000);
    expect(info.remaining).toBe(0);
  });
});
