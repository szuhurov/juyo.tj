import { describe, it, expect, vi } from 'vitest';
import { VipService } from '@/lib/services/vip-service';
import type { SupabaseClient } from '@supabase/supabase-js';

const makeChain = (result: { data: any; error: any }) => {
  const chain: any = {};
  const builders = ['select', 'eq', 'order'];
  for (const m of builders) chain[m] = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: Function, reject?: Function) => Promise.resolve(result).then(resolve as any, reject as any);
  return chain;
};

const makeMockClient = (fromResult?: { data: any; error: any }, rpcResult?: { data: any; error: any }) =>
  ({
    from: vi.fn().mockReturnValue(makeChain(fromResult ?? { data: [], error: null })),
    rpc: vi.fn().mockResolvedValue(rpcResult ?? { data: null, error: null }),
  }) as unknown as SupabaseClient;

describe('VipService.getPlans', () => {
  it('reads from vip_plans (a public table, not an RPC) and maps fields', async () => {
    const client = makeMockClient({
      data: [{ id: 'p1', tier: 'vip', duration_days: 5, price_tjs: '25.00', currency: 'TJS' }],
      error: null,
    });
    const plans = await VipService.getPlans(client);
    expect(client.from).toHaveBeenCalledWith('vip_plans');
    expect(plans).toEqual([{ id: 'p1', tier: 'vip', durationDays: 5, priceTjs: 25, currency: 'TJS' }]);
  });

  it('throws on error', async () => {
    const client = makeMockClient({ data: null, error: { message: 'boom' } });
    await expect(VipService.getPlans(client)).rejects.toBeTruthy();
  });
});

describe('VipService.getMyStatus', () => {
  it('returns null when the caller has no active subscription', async () => {
    const client = makeMockClient(undefined, { data: [], error: null });
    const status = await VipService.getMyStatus(client);
    expect(status).toBeNull();
  });

  it('maps the first row when active', async () => {
    const client = makeMockClient(undefined, {
      data: [{ tier: 'vvip', expires_at: '2026-10-01T00:00:00.000Z', subscription_id: 's1' }],
      error: null,
    });
    const status = await VipService.getMyStatus(client);
    expect(status).toEqual({ tier: 'vvip', expiresAt: '2026-10-01T00:00:00.000Z', subscriptionId: 's1' });
  });
});

describe('VipService.createSubscription', () => {
  it('calls create_subscription with ONLY the plan id — never price/duration/status', async () => {
    const client = makeMockClient(undefined, { data: 'new-sub-id', error: null });
    const id = await VipService.createSubscription('plan-123', client);
    expect(client.rpc).toHaveBeenCalledWith('create_subscription', { p_plan_id: 'plan-123' });
    expect(id).toBe('new-sub-id');
  });

  it('throws when the RPC rejects (e.g. duplicate pending)', async () => {
    const client = makeMockClient(undefined, { data: null, error: { message: 'You already have a pending subscription request' } });
    await expect(VipService.createSubscription('plan-123', client)).rejects.toBeTruthy();
  });
});

describe('VipService.cancelSubscription', () => {
  it('calls cancel_subscription with the subscription id', async () => {
    const client = makeMockClient(undefined, { data: null, error: null });
    await VipService.cancelSubscription('sub-1', client);
    expect(client.rpc).toHaveBeenCalledWith('cancel_subscription', { p_subscription_id: 'sub-1' });
  });
});

describe('VipService.getMySubscriptions', () => {
  it('maps price_tjs to a number and passes through status/dates', async () => {
    const client = makeMockClient(undefined, {
      data: [
        {
          id: 's1', tier: 'vip', duration_days: 5, price_tjs: '25.00', currency: 'TJS', status: 'active',
          starts_at: '2026-09-25T00:00:00.000Z', expires_at: '2026-09-30T00:00:00.000Z',
          created_at: '2026-09-25T00:00:00.000Z', cancelled_at: null, cancel_reason: null,
        },
      ],
      error: null,
    });
    const subs = await VipService.getMySubscriptions(20, client);
    expect(subs[0].priceTjs).toBe(25);
    expect(subs[0].status).toBe('active');
  });
});
