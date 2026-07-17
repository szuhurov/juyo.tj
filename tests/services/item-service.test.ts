import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItemService, CATEGORIES } from '@/lib/services/item-service';
import type { SupabaseClient } from '@supabase/supabase-js';

// Supabase query builder is thenable — every builder method returns `this`,
// and the chain itself resolves when awaited.
const makeChain = (result = { data: [] as any, error: null as any }) => {
  const chain: any = {};
  const builders = ['select', 'order', 'range', 'eq', 'or', 'textSearch', 'not', 'update', 'delete', 'limit'];
  for (const m of builders) chain[m] = vi.fn().mockReturnValue(chain);

  // Terminal methods return promises
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);

  // insert returns a thenable chain (can be awaited directly OR chained with .select().single())
  chain.insert = vi.fn().mockReturnValue({
    ...chain,
    select: vi.fn().mockReturnValue({
      ...chain,
      single: vi.fn().mockResolvedValue(result),
    }),
    then: (resolve: Function, reject?: Function) => Promise.resolve(result).then(resolve as any, reject as any),
  });

  // The chain itself is thenable so `await query` works
  chain.then = (resolve: Function, reject?: Function) =>
    Promise.resolve(result).then(resolve as any, reject as any);

  return chain;
};

const makeMockClient = (result?: { data: any; error: any }) => {
  const chain = makeChain(result);
  const mock = {
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    storage: {
      from: vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/img.jpg' } }),
      }),
    },
    _chain: chain,
  };
  return mock as typeof mock & SupabaseClient;
};

// ─────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────
describe('CATEGORIES', () => {
  it('has exactly 8 categories', () => {
    expect(CATEGORIES).toHaveLength(8);
  });

  it('every category has id, name, and icon', () => {
    for (const cat of CATEGORIES) {
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('name');
      expect(cat).toHaveProperty('icon');
    }
  });

  it('category ids are unique', () => {
    const ids = CATEGORIES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes Electronics, Documents, Keys, Clothing, Pets, Other, LicensePlate, Wallet', () => {
    const names = CATEGORIES.map(c => c.name);
    expect(names).toContain('Electronics');
    expect(names).toContain('Documents');
    expect(names).toContain('Keys');
    expect(names).toContain('Clothing');
    expect(names).toContain('Pets');
    expect(names).toContain('Other');
    expect(names).toContain('LicensePlate');
    expect(names).toContain('Wallet');
  });
});

// ─────────────────────────────────────────────
// getItems
// ─────────────────────────────────────────────
describe('ItemService.getItems', () => {
  it('filters ONLY approved items for public feed — never null moderation', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({}, mock);

    const eqCalls: string[][] = mock._chain.eq.mock.calls;
    expect(eqCalls).toContainEqual(['moderation_status', 'approved']);

    // Must NOT allow null moderation — check that `or` was NOT used for moderation
    const orCalls: string[] = mock._chain.or.mock.calls.map((c: any[]) => c[0]);
    const allowsNull = orCalls.some(c => c.includes('moderation_status.is.null'));
    expect(allowsNull).toBe(false);
  });

  it('does NOT apply moderation filter when user_id is provided', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ user_id: 'user-123' }, mock);

    const eqCalls: string[][] = mock._chain.eq.mock.calls;
    const hasModFilter = eqCalls.some(c => c[0] === 'moderation_status');
    expect(hasModFilter).toBe(false);
    expect(eqCalls).toContainEqual(['user_id', 'user-123']);
  });

  it('applies category filter when category is not "All"', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ category: 'Electronics' }, mock);

    const eqCalls: string[][] = mock._chain.eq.mock.calls;
    expect(eqCalls).toContainEqual(['category', 'Electronics']);
  });

  it('does NOT apply category filter when category is "All"', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ category: 'All' }, mock);

    const eqCalls: string[][] = mock._chain.eq.mock.calls;
    const hasCatFilter = eqCalls.some(c => c[0] === 'category');
    expect(hasCatFilter).toBe(false);
  });

  it('applies type filter', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ type: 'lost' }, mock);

    const eqCalls: string[][] = mock._chain.eq.mock.calls;
    expect(eqCalls).toContainEqual(['type', 'lost']);
  });

  it('applies ilike search on title and description', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ search: 'телефон' }, mock);

    const orCalls: string[] = mock._chain.or.mock.calls.map((c: any[]) => c[0]);
    expect(orCalls.some((arg: string) => arg.includes('ilike') && arg.includes('телефон'))).toBe(true);
  });

  it('trims whitespace from search query', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ search: '  телефон  ' }, mock);

    const orCalls: string[] = mock._chain.or.mock.calls.map((c: any[]) => c[0]);
    expect(orCalls.some((arg: string) => arg.includes('телефон') && !arg.includes('  '))).toBe(true);
  });

  it('limits search query to 200 characters', async () => {
    const longSearch = 'а'.repeat(300);
    const mock = makeMockClient();
    await ItemService.getItems({ search: longSearch }, mock);

    const orCalls: string[] = mock._chain.or.mock.calls.map((c: any[]) => c[0]);
    expect(orCalls.some((arg: string) => !arg.includes('а'.repeat(201)))).toBe(true);
  });

  it('uses correct pagination range for page 2 with pageSize 10', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ page: 2, pageSize: 10 }, mock);

    expect(mock._chain.range).toHaveBeenCalledWith(20, 29);
  });

  it('uses correct pagination range for page 0 (first page)', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ page: 0, pageSize: 20 }, mock);

    expect(mock._chain.range).toHaveBeenCalledWith(0, 19);
  });

  it('orders results by created_at descending', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({}, mock);

    expect(mock._chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('throws when supabase returns an error', async () => {
    const mock = makeMockClient({ data: null, error: new Error('DB error') });
    await expect(ItemService.getItems({}, mock)).rejects.toThrow('DB error');
  });
});

// ─────────────────────────────────────────────
// getItemDetails
// ─────────────────────────────────────────────
describe('ItemService.getItemDetails', () => {
  // Ёрирасон барои сохтани mock бо ду query алоҳида
  const makeItemDetailsMock = (
    itemResult = { data: { id: 'item-1', user_id: 'user-1', title: 'Телефон', images: [] } as any, error: null as any },
    profileResult = { data: { first_name: 'Алӣ', last_name: 'Алиев', avatar_url: null } as any, error: null as any }
  ) => {
    const itemChain = makeChain(itemResult);
    const profileChain = makeChain(profileResult);
    const mock: any = {
      from: vi.fn((table: string) => {
        if (table === 'public_profiles') return profileChain;
        return itemChain;
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      _itemChain: itemChain,
      _profileChain: profileChain,
    };
    return mock;
  };

  it('fetches item from items table, then profile from public_profiles separately', async () => {
    const mock = makeItemDetailsMock();
    await ItemService.getItemDetails('item-1', mock);

    expect(mock.from).toHaveBeenCalledWith('items');
    expect(mock.from).toHaveBeenCalledWith('public_profiles');
    expect(mock.from).toHaveBeenCalledTimes(2);
  });

  it('includes item_images in the items select string', async () => {
    const mock = makeItemDetailsMock();
    await ItemService.getItemDetails('item-1', mock);

    const selectArg: string = mock._itemChain.select.mock.calls[0][0];
    expect(selectArg).toContain('item_images');
  });

  it('merges profile data into returned item', async () => {
    const mockItem = { id: 'item-1', user_id: 'user-1', title: 'Телефон', images: [] };
    const mockProfile = { first_name: 'Алӣ', last_name: 'Алиев', avatar_url: null };
    const mock = makeItemDetailsMock(
      { data: mockItem, error: null },
      { data: mockProfile, error: null }
    );

    const result = await ItemService.getItemDetails('item-1', mock);

    expect(result).toMatchObject({ ...mockItem, profiles: mockProfile });
  });

  it('filters by correct item id', async () => {
    const mock = makeItemDetailsMock();
    await ItemService.getItemDetails('abc-123', mock);

    expect(mock._itemChain.eq).toHaveBeenCalledWith('id', 'abc-123');
  });

  it('throws when item not found', async () => {
    const mock = makeItemDetailsMock({ data: null, error: new Error('Not found') });
    await expect(ItemService.getItemDetails('bad-id', mock)).rejects.toThrow('Not found');
  });

  it('returns profiles: null when profile fetch returns nothing', async () => {
    const mock = makeItemDetailsMock(
      { data: { id: 'item-1', user_id: 'user-1', title: 'Test', images: [] }, error: null },
      { data: null, error: null }
    );
    const result = await ItemService.getItemDetails('item-1', mock);
    expect(result?.profiles).toBeNull();
  });
});

// ─────────────────────────────────────────────
// toggleSaveItem
// ─────────────────────────────────────────────
describe('ItemService.toggleSaveItem', () => {
  it('returns true (saved) when item was NOT previously saved', async () => {
    const mock = makeMockClient({ data: null, error: null });
    // maybeSingle returns null → item not saved
    mock._chain.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await ItemService.toggleSaveItem(mock, 'user-1', 'item-1');
    expect(result).toBe(true);
  });

  it('inserts with correct user_id and item_id when not saved', async () => {
    const mock = makeMockClient({ data: null, error: null });
    mock._chain.maybeSingle.mockResolvedValue({ data: null, error: null });

    await ItemService.toggleSaveItem(mock, 'user-1', 'item-1');

    expect(mock._chain.insert).toHaveBeenCalledWith([
      { user_id: 'user-1', item_id: 'item-1' },
    ]);
  });

  it('returns false (unsaved) when item WAS previously saved', async () => {
    const mock = makeMockClient({ data: null, error: null });
    mock._chain.maybeSingle.mockResolvedValue({ data: { item_id: 'item-1' }, error: null });

    const result = await ItemService.toggleSaveItem(mock, 'user-1', 'item-1');
    expect(result).toBe(false);
  });

  it('throws on database error during check', async () => {
    const mock = makeMockClient({ data: null, error: null });
    mock._chain.maybeSingle.mockResolvedValue({ data: null, error: new Error('RLS') });

    await expect(ItemService.toggleSaveItem(mock, 'user-1', 'item-1')).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────
// deleteItem
// ─────────────────────────────────────────────
describe('ItemService.deleteItem', () => {
  it('soft-deletes by updating the items table, not removing the row', async () => {
    const mock = makeMockClient({ data: [], error: null });

    await ItemService.deleteItem(mock, 'item-42');

    const fromCalls: string[] = mock.from.mock.calls.map((c: any[]) => c[0]);
    expect(fromCalls).toContain('items');
    expect(mock._chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'deleted', deleted_at: expect.any(String) }),
    );
    expect(mock._chain.eq).toHaveBeenCalledWith('id', 'item-42');
  });

  it('does not touch storage', async () => {
    const mock = makeMockClient({ data: [], error: null });

    await ItemService.deleteItem(mock, 'item-1');

    expect(mock.storage.from).not.toHaveBeenCalled();
  });

  it('throws when the update fails', async () => {
    const mock = makeMockClient({ data: null, error: new Error('DB error') });

    await expect(ItemService.deleteItem(mock, 'item-1')).rejects.toThrow();
  });
});
