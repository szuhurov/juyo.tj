import { describe, it, expect, vi } from 'vitest';
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
  it('has exactly 11 categories', () => {
    expect(CATEGORIES).toHaveLength(11);
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
// getItems — filters/pagination are forwarded to the search_items RPC
// (supabase/migrations/20260714000000_search_items_rpc.sql onward); the
// moderation/sort logic that used to live in a JS query-builder chain has
// moved entirely into that RPC's SQL, so it's no longer observable here.
// ─────────────────────────────────────────────
describe('ItemService.getItems', () => {
  it('calls the search_items RPC', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({}, mock);

    expect(mock.rpc).toHaveBeenCalledWith('search_items', expect.any(Object));
  });

  it('passes category as p_category, or null when "All"/unset', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ category: 'Electronics' }, mock);
    expect(mock.rpc).toHaveBeenCalledWith(
      'search_items',
      expect.objectContaining({ p_category: 'Electronics' }),
    );

    const mockAll = makeMockClient();
    await ItemService.getItems({ category: 'All' }, mockAll);
    expect(mockAll.rpc).toHaveBeenCalledWith(
      'search_items',
      expect.objectContaining({ p_category: null }),
    );
  });

  it('passes type as p_type', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ type: 'lost' }, mock);
    expect(mock.rpc).toHaveBeenCalledWith(
      'search_items',
      expect.objectContaining({ p_type: 'lost' }),
    );
  });

  it('passes user_id as p_user_id', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ user_id: 'user-123' }, mock);
    expect(mock.rpc).toHaveBeenCalledWith(
      'search_items',
      expect.objectContaining({ p_user_id: 'user-123' }),
    );
  });

  it('passes locationType as p_location_type, or null when unset', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ locationType: 'taxi' }, mock);
    expect(mock.rpc).toHaveBeenCalledWith(
      'search_items',
      expect.objectContaining({ p_location_type: 'taxi' }),
    );

    const mockUnset = makeMockClient();
    await ItemService.getItems({}, mockUnset);
    expect(mockUnset.rpc).toHaveBeenCalledWith(
      'search_items',
      expect.objectContaining({ p_location_type: null }),
    );
  });

  it('passes city as p_city, or null when unset', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ city: 'khujand' }, mock);
    expect(mock.rpc).toHaveBeenCalledWith(
      'search_items',
      expect.objectContaining({ p_city: 'khujand' }),
    );

    const mockUnset = makeMockClient();
    await ItemService.getItems({}, mockUnset);
    expect(mockUnset.rpc).toHaveBeenCalledWith(
      'search_items',
      expect.objectContaining({ p_city: null }),
    );
  });

  it('combines city with category/type/date without dropping either', async () => {
    const mock = makeMockClient();
    await ItemService.getItems(
      { city: 'bokhtar', category: 'Electronics', type: 'found', dateFrom: '2026-01-01' },
      mock,
    );
    expect(mock.rpc).toHaveBeenCalledWith(
      'search_items',
      expect.objectContaining({
        p_city: 'bokhtar',
        p_category: 'Electronics',
        p_type: 'found',
        p_date_from: '2026-01-01',
      }),
    );
  });

  it('trims whitespace from search query', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ search: '  телефон  ' }, mock);
    expect(mock.rpc).toHaveBeenCalledWith(
      'search_items',
      expect.objectContaining({ p_search: 'телефон' }),
    );
  });

  it('limits search query to 200 characters', async () => {
    const longSearch = 'а'.repeat(300);
    const mock = makeMockClient();
    await ItemService.getItems({ search: longSearch }, mock);

    const call = (mock.rpc as any).mock.calls[0][1];
    expect((call.p_search as string).length).toBeLessThanOrEqual(200);
  });

  it('passes null p_search when no search text given', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({}, mock);
    expect(mock.rpc).toHaveBeenCalledWith(
      'search_items',
      expect.objectContaining({ p_search: null }),
    );
  });

  it('computes p_limit/p_offset for page 2 with pageSize 10', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ page: 2, pageSize: 10 }, mock);
    expect(mock.rpc).toHaveBeenCalledWith(
      'search_items',
      expect.objectContaining({ p_limit: 10, p_offset: 20 }),
    );
  });

  it('defaults to page 0 / pageSize 20', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({}, mock);
    expect(mock.rpc).toHaveBeenCalledWith(
      'search_items',
      expect.objectContaining({ p_limit: 20, p_offset: 0 }),
    );
  });

  it('passes dateFrom/dateTo through as p_date_from/p_date_to', async () => {
    const mock = makeMockClient();
    await ItemService.getItems(
      { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
      mock,
    );
    expect(mock.rpc).toHaveBeenCalledWith(
      'search_items',
      expect.objectContaining({
        p_date_from: '2026-01-01',
        p_date_to: '2026-01-31',
      }),
    );
  });

  it('throws when the RPC returns an error', async () => {
    const mock = makeMockClient();
    mock.rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') });
    await expect(ItemService.getItems({}, mock)).rejects.toThrow('DB error');
  });

  it('backslash-escapes % _ \\ in the search text (the RPC expects this)', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ search: '50%_a\\b' }, mock);
    const call = (mock.rpc as any).mock.calls[0][1];
    expect(call.p_search).toBe('50\\%\\_a\\\\b');
  });

  it('trims before slicing to 200 chars, and slices before escaping', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ search: `  ${'a'.repeat(199)}%  ` }, mock);
    const call = (mock.rpc as any).mock.calls[0][1];
    expect(call.p_search).toBe(`${'a'.repeat(199)}\\%`);
  });

  it('treats a whitespace-only search as no search (p_search null)', async () => {
    const mock = makeMockClient();
    await ItemService.getItems({ search: '   ' }, mock);
    expect((mock.rpc as any).mock.calls[0][1].p_search).toBeNull();
  });

  it('maps every filter to its RPC parameter in one call', async () => {
    const mock = makeMockClient();
    await ItemService.getItems(
      {
        search: 'калид',
        category: 'Keys',
        type: 'found',
        user_id: 'u1',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        locationType: 'airport',
        city: 'dushanbe',
        page: 3,
        pageSize: 20,
      },
      mock,
    );
    expect(mock.rpc).toHaveBeenCalledWith('search_items', {
      p_search: 'калид',
      p_category: 'Keys',
      p_type: 'found',
      p_user_id: 'u1',
      p_limit: 20,
      p_offset: 60,
      p_date_from: '2026-01-01',
      p_date_to: '2026-01-31',
      p_location_type: 'airport',
      p_city: 'dushanbe',
    });
  });

  it('forwards the abort signal to the RPC builder when provided', async () => {
    const mock = makeMockClient();
    const result = { data: [{ id: 'x' }], error: null };
    const builder = {
      abortSignal: vi.fn().mockResolvedValue(result),
    };
    mock.rpc = vi.fn().mockReturnValue(builder);
    const controller = new AbortController();

    const items = await ItemService.getItems({ search: 'a' }, mock, {
      signal: controller.signal,
    });

    expect(builder.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(items).toEqual([{ id: 'x' }]);
  });

  it('does not touch abortSignal when no signal is given', async () => {
    const mock = makeMockClient();
    const builder = Object.assign(Promise.resolve({ data: [], error: null }), {
      abortSignal: vi.fn(),
    });
    mock.rpc = vi.fn().mockReturnValue(builder);

    await ItemService.getItems({}, mock);

    expect(builder.abortSignal).not.toHaveBeenCalled();
  });

  it('throws the error returned by an aborted request (React Query swallows it after cancel)', async () => {
    const mock = makeMockClient();
    const abortErr = Object.assign(new Error('AbortError'), { name: 'AbortError' });
    mock.rpc = vi.fn().mockReturnValue({
      abortSignal: vi.fn().mockResolvedValue({ data: null, error: abortErr }),
    });
    await expect(
      ItemService.getItems({}, mock, { signal: new AbortController().signal }),
    ).rejects.toBe(abortErr);
  });
});

describe('ItemService.getVipItems', () => {
  it('calls get_vip_items with p_limit (default 20)', async () => {
    const mock = makeMockClient();
    mock.rpc = vi.fn().mockResolvedValue({ data: [{ id: 'v1' }], error: null });
    const items = await ItemService.getVipItems(undefined, mock);
    expect(mock.rpc).toHaveBeenCalledWith('get_vip_items', { p_limit: 20 });
    expect(items).toEqual([{ id: 'v1' }]);

    await ItemService.getVipItems(5, mock);
    expect(mock.rpc).toHaveBeenLastCalledWith('get_vip_items', { p_limit: 5 });
  });

  it('forwards the abort signal only when provided', async () => {
    const mock = makeMockClient();
    const builder = { abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }) };
    mock.rpc = vi.fn().mockReturnValue(builder);
    const controller = new AbortController();
    await ItemService.getVipItems(20, mock, { signal: controller.signal });
    expect(builder.abortSignal).toHaveBeenCalledWith(controller.signal);

    const plain = Object.assign(Promise.resolve({ data: [], error: null }), {
      abortSignal: vi.fn(),
    });
    mock.rpc = vi.fn().mockReturnValue(plain);
    await ItemService.getVipItems(20, mock);
    expect(plain.abortSignal).not.toHaveBeenCalled();
  });

  it('returns [] for null data and throws on RPC error', async () => {
    const mock = makeMockClient();
    mock.rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await expect(ItemService.getVipItems(20, mock)).resolves.toEqual([]);

    mock.rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') });
    await expect(ItemService.getVipItems(20, mock)).rejects.toThrow('DB error');
  });
});

// ─────────────────────────────────────────────
// getItemDetails
// ─────────────────────────────────────────────
describe('ItemService.getItemDetails', () => {
  // Helper for building a mock with two separate queries
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
