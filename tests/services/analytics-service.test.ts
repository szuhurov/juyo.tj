import { describe, it, expect, vi } from 'vitest';
import { AnalyticsService } from '@/lib/services/analytics-service';
import type { SupabaseClient } from '@supabase/supabase-js';

const makeMockClient = (rpcResult?: { data: any; error: any }) =>
  ({
    rpc: vi.fn().mockResolvedValue(rpcResult ?? { data: null, error: null }),
  }) as unknown as SupabaseClient;

describe('AnalyticsService.getMyAnalyticsSummary', () => {
  it('calls get_my_analytics_summary with the requested day range — never a client user id', async () => {
    const client = makeMockClient({ data: { totalPosts: 4, lostPosts: 1, foundPosts: 3 }, error: null });
    const result = await AnalyticsService.getMyAnalyticsSummary(30, client);
    expect(client.rpc).toHaveBeenCalledWith('get_my_analytics_summary', { p_days: 30 });
    expect(result).toEqual({ totalPosts: 4, lostPosts: 1, foundPosts: 3 });
  });

  it('defaults to 30 days and propagates an unauthenticated error', async () => {
    const client = makeMockClient({ data: null, error: { message: 'Not authenticated' } });
    await expect(AnalyticsService.getMyAnalyticsSummary(undefined, client)).rejects.toBeTruthy();
  });
});
