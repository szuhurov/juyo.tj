import { describe, it, expect, vi } from 'vitest';

// Test the pure logic of ITEM_KEYS and pagination without React
describe('ITEM_KEYS', () => {
  it('list key includes filters', async () => {
    const { ITEM_KEYS } = await import('@/lib/hooks/use-items');
    const key = ITEM_KEYS.list({ search: 'телефон', category: 'Electronics' });
    expect(JSON.stringify(key)).toContain('телефон');
    expect(JSON.stringify(key)).toContain('Electronics');
  });

  it('different filters produce different keys', async () => {
    const { ITEM_KEYS } = await import('@/lib/hooks/use-items');
    const key1 = ITEM_KEYS.list({ search: 'калид' });
    const key2 = ITEM_KEYS.list({ search: 'телефон' });
    expect(JSON.stringify(key1)).not.toBe(JSON.stringify(key2));
  });

  it('detail key includes item id', async () => {
    const { ITEM_KEYS } = await import('@/lib/hooks/use-items');
    const key = ITEM_KEYS.detail('item-abc-123');
    expect(key).toContain('item-abc-123');
  });

  it('userItems key includes userId', async () => {
    const { ITEM_KEYS } = await import('@/lib/hooks/use-items');
    const key = ITEM_KEYS.userItems('user-xyz');
    expect(key).toContain('user-xyz');
  });

  it('all keys are arrays (required by React Query)', async () => {
    const { ITEM_KEYS } = await import('@/lib/hooks/use-items');
    expect(Array.isArray(ITEM_KEYS.all)).toBe(true);
    expect(Array.isArray(ITEM_KEYS.lists())).toBe(true);
    expect(Array.isArray(ITEM_KEYS.list({}))).toBe(true);
    expect(Array.isArray(ITEM_KEYS.details())).toBe(true);
    expect(Array.isArray(ITEM_KEYS.detail('x'))).toBe(true);
    expect(Array.isArray(ITEM_KEYS.userItems('u'))).toBe(true);
    expect(Array.isArray(ITEM_KEYS.savedItems('u'))).toBe(true);
  });
});

describe('Pagination logic (getNextPageParam)', () => {
  const PAGE_SIZE = 20;
  const MAX_PAGES = 10;

  function getNextPageParam(lastPage: any[], allPages: any[][]): number | undefined {
    if (allPages.length >= MAX_PAGES) return undefined;
    return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
  }

  it('returns next page number when last page is full', () => {
    const lastPage = Array(PAGE_SIZE).fill({});
    const allPages = [lastPage];
    expect(getNextPageParam(lastPage, allPages)).toBe(1);
  });

  it('returns undefined when last page is not full (end of data)', () => {
    const lastPage = Array(5).fill({});
    const allPages = [Array(PAGE_SIZE).fill({}), lastPage];
    expect(getNextPageParam(lastPage, allPages)).toBeUndefined();
  });

  it('returns undefined when last page is empty', () => {
    const lastPage: any[] = [];
    const allPages = [lastPage];
    expect(getNextPageParam(lastPage, allPages)).toBeUndefined();
  });

  it('stops at MAX_PAGES to prevent memory overflow', () => {
    const fullPage = Array(PAGE_SIZE).fill({});
    const allPages = Array(MAX_PAGES).fill(fullPage);
    expect(getNextPageParam(fullPage, allPages)).toBeUndefined();
  });

  it('allows exactly MAX_PAGES - 1 pages to load more', () => {
    const fullPage = Array(PAGE_SIZE).fill({});
    const allPages = Array(MAX_PAGES - 1).fill(fullPage);
    const next = getNextPageParam(fullPage, allPages);
    expect(next).toBe(MAX_PAGES - 1);
  });

  it('correctly calculates next page param as allPages.length', () => {
    const fullPage = Array(PAGE_SIZE).fill({});
    const allPages = [fullPage, fullPage, fullPage]; // 3 pages loaded
    expect(getNextPageParam(fullPage, allPages)).toBe(3);
  });
});
