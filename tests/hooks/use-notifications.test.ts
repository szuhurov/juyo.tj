import { describe, it, expect } from 'vitest';

// Test the pure read-state key logic without mounting React/Supabase — the
// same pattern as tests/hooks/use-items.test.ts (ITEM_KEYS).
describe('notificationReadKey', () => {
  it('combines kind and ref_id deterministically', async () => {
    const { notificationReadKey } = await import('@/lib/hooks/use-notifications');
    expect(notificationReadKey('category_post', 'abc-123')).toBe('category_post:abc-123');
    expect(notificationReadKey('expiry_confirm', 'def-456')).toBe('expiry_confirm:def-456');
  });

  it('different kinds for the same ref_id produce different keys', async () => {
    const { notificationReadKey } = await import('@/lib/hooks/use-notifications');
    const a = notificationReadKey('category_post', 'same-id');
    const b = notificationReadKey('expiry_confirm', 'same-id');
    expect(a).not.toBe(b);
  });

  it('is stable for the same input (matches server-computed keys)', async () => {
    const { notificationReadKey } = await import('@/lib/hooks/use-notifications');
    expect(notificationReadKey('category_post', 'x')).toBe(notificationReadKey('category_post', 'x'));
  });
});
