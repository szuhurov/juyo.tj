import { describe, it, expect, vi, afterEach } from 'vitest';

async function loadFlag() {
  vi.resetModules();
  return (await import('@/lib/feature-flags')).PAID_FEATURES_ENABLED;
}

describe('PAID_FEATURES_ENABLED', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is off when the env var is not set (first public release)', async () => {
    vi.stubEnv('NEXT_PUBLIC_PAID_FEATURES_ENABLED', '');
    expect(await loadFlag()).toBe(false);
  });

  it('only turns on for the exact string "true"', async () => {
    vi.stubEnv('NEXT_PUBLIC_PAID_FEATURES_ENABLED', '1');
    expect(await loadFlag()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_PAID_FEATURES_ENABLED', 'true');
    expect(await loadFlag()).toBe(true);
  });
});
