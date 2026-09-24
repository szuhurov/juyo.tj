import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/services/item-service', () => ({
  ItemService: { getItems: vi.fn() },
}));

import { ItemService } from '@/lib/services/item-service';
import { useItems } from '@/lib/hooks/use-items';

const getItems = vi.mocked(ItemService.getItems);

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe('useItems request cancellation', () => {
  beforeEach(() => {
    getItems.mockReset();
  });

  it('passes React Query\'s AbortSignal to ItemService.getItems', async () => {
    getItems.mockResolvedValue([]);
    const { result } = renderHook(() => useItems({ search: 'ключ' }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [filters, client, options] = getItems.mock.calls[0];
    expect(filters).toMatchObject({ search: 'ключ', page: 0, pageSize: 20 });
    expect(client).toBeUndefined();
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it('aborts the superseded request and never shows it as an error', async () => {
    const signals: AbortSignal[] = [];
    getItems.mockImplementation((filters, _c, options) => {
      const signal = options!.signal!;
      signals.push(signal);
      if (filters?.search === 'a') {
        // Stays pending until aborted, then rejects like supabase-js would.
        return new Promise((_res, rej) =>
          signal.addEventListener('abort', () => rej(new Error('AbortError'))),
        );
      }
      return Promise.resolve([]);
    });

    const { result, rerender } = renderHook(
      ({ search }) => useItems({ search }),
      { wrapper: wrapper(), initialProps: { search: 'a' } },
    );
    await waitFor(() => expect(getItems).toHaveBeenCalledTimes(1));

    rerender({ search: 'ab' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(signals[0].aborted).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
