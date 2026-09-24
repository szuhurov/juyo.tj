import { describe, it, expect, vi } from 'vitest';
import { BusinessService } from '@/lib/services/business-service';
import type { SupabaseClient } from '@supabase/supabase-js';

function makeChain(result: { data: any; error: any }) {
  const chain: any = {};
  for (const m of ['select', 'eq']) chain[m] = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: Function, reject?: Function) => Promise.resolve(result).then(resolve as any, reject as any);
  return chain;
}

const makeMockClient = (fromResult?: { data: any; error: any }, rpcResult?: { data: any; error: any }) =>
  ({
    from: vi.fn().mockReturnValue(makeChain(fromResult ?? { data: [], error: null })),
    rpc: vi.fn().mockResolvedValue(rpcResult ?? { data: null, error: null }),
  }) as unknown as SupabaseClient;

describe('BusinessService.getPlans / getPlanPrices / getPlanLimits', () => {
  it('getPlans reads the public business_plans table, not an RPC', async () => {
    const client = makeMockClient({ data: [{ id: 'p1', tier: 'business', name: 'Business', is_custom: false }], error: null });
    const plans = await BusinessService.getPlans(client);
    expect(client.from).toHaveBeenCalledWith('business_plans');
    expect(plans).toEqual([{ id: 'p1', tier: 'business', name: 'Business', isCustom: false }]);
  });

  it('getPlanPrices maps null price_amount through untouched (Enterprise/custom has no fixed price)', async () => {
    const client = makeMockClient({
      data: [
        { plan_id: 'p-business', billing_interval: 'monthly', price_amount: '299.00', currency: 'TJS' },
        { plan_id: 'p-enterprise', billing_interval: 'custom', price_amount: null, currency: 'TJS' },
      ],
      error: null,
    });
    const prices = await BusinessService.getPlanPrices(client);
    expect(prices[0]).toEqual({ planId: 'p-business', billingInterval: 'monthly', priceAmount: 299, currency: 'TJS' });
    expect(prices[1].priceAmount).toBeNull();
  });

  it('official prices are exactly 299/2990 (business) and 699/6990 (business pro) — regression guard against inventing different numbers', async () => {
    const client = makeMockClient({
      data: [
        { plan_id: 'business', billing_interval: 'monthly', price_amount: '299.00', currency: 'TJS' },
        { plan_id: 'business', billing_interval: 'annual', price_amount: '2990.00', currency: 'TJS' },
        { plan_id: 'business_pro', billing_interval: 'monthly', price_amount: '699.00', currency: 'TJS' },
        { plan_id: 'business_pro', billing_interval: 'annual', price_amount: '6990.00', currency: 'TJS' },
      ],
      error: null,
    });
    const prices = await BusinessService.getPlanPrices(client);
    expect(prices.map((p) => p.priceAmount)).toEqual([299, 2990, 699, 6990]);
  });

  it('getPlanLimits maps limit_key/limit_value through, including feature flags', async () => {
    const client = makeMockClient({
      data: [
        { plan_id: 'p1', limit_key: 'max_branches', limit_value: 3 },
        { plan_id: 'p1', limit_key: 'ai_matching', limit_value: 1 },
      ],
      error: null,
    });
    const limits = await BusinessService.getPlanLimits(client);
    expect(limits).toEqual([
      { planId: 'p1', limitKey: 'max_branches', limitValue: 3 },
      { planId: 'p1', limitKey: 'ai_matching', limitValue: 1 },
    ]);
  });
});

describe('BusinessService.getOrganizationBusinessPlan', () => {
  it('calls the RPC with only the organization id and maps the resolved row', async () => {
    const client = makeMockClient(undefined, {
      data: [{
        subscription_id: 'sub-1', plan_tier: 'free', plan_name: 'Free', billing_interval: 'monthly',
        status: 'active', is_custom: false, trial_ends_at: null, starts_at: '2026-09-28T00:00:00.000Z', ends_at: null,
        limits: { max_branches: 1, max_staff: 3 },
      }],
      error: null,
    });
    const plan = await BusinessService.getOrganizationBusinessPlan('org-1', client);
    expect(client.rpc).toHaveBeenCalledWith('get_organization_business_plan', { p_organization_id: 'org-1' });
    expect(plan?.planTier).toBe('free');
    expect(plan?.limits).toEqual({ max_branches: 1, max_staff: 3 });
  });

  it('returns null when the RPC resolves no current subscription', async () => {
    const client = makeMockClient(undefined, { data: [], error: null });
    expect(await BusinessService.getOrganizationBusinessPlan('org-1', client)).toBeNull();
  });
});

describe('BusinessService entitlement checks', () => {
  it('canCreateBranch / canAddStaff call the correct RPCs with only the organization id', async () => {
    const client = makeMockClient(undefined, { data: true, error: null });
    await BusinessService.canCreateBranch('org-1', client);
    expect(client.rpc).toHaveBeenCalledWith('can_create_branch', { p_organization_id: 'org-1' });

    await BusinessService.canAddStaff('org-1', client);
    expect(client.rpc).toHaveBeenCalledWith('can_add_staff', { p_organization_id: 'org-1' });
  });

  it('canUseAiMatching / canUseAdvancedAnalytics / canAccessBusinessReports call their respective RPCs', async () => {
    const client = makeMockClient(undefined, { data: true, error: null });
    await BusinessService.canUseAiMatching('org-1', client);
    expect(client.rpc).toHaveBeenCalledWith('can_use_ai_matching', { p_organization_id: 'org-1' });

    await BusinessService.canUseAdvancedAnalytics('org-1', client);
    expect(client.rpc).toHaveBeenCalledWith('can_use_advanced_analytics', { p_organization_id: 'org-1' });

    await BusinessService.canAccessBusinessReports('org-1', client);
    expect(client.rpc).toHaveBeenCalledWith('can_access_business_reports', { p_organization_id: 'org-1' });
  });

  it('hasFeature is the generic primitive — passes the feature key through untouched', async () => {
    const client = makeMockClient(undefined, { data: false, error: null });
    const allowed = await BusinessService.hasFeature('org-1', 'priority_support', client);
    expect(client.rpc).toHaveBeenCalledWith('has_organization_feature', { p_organization_id: 'org-1', p_feature_key: 'priority_support' });
    expect(allowed).toBe(false);
  });
});

describe('BusinessService.getOrganizationLimitStatus', () => {
  it('exposes exceeded state without ever implying data was deleted (downgrade safety)', async () => {
    const client = makeMockClient(undefined, {
      data: {
        max_branches: { limit: 3, usage: 10, exceeded: true },
        max_staff: { limit: 10, usage: 4, exceeded: false },
      },
      error: null,
    });
    const status = await BusinessService.getOrganizationLimitStatus('org-1', client);
    expect(status.maxBranches).toEqual({ limit: 3, usage: 10, exceeded: true });
    expect(status.maxStaff.exceeded).toBe(false);
  });
});

describe('BusinessService.cancelSubscription', () => {
  it('calls cancel_organization_subscription with only the organization id', async () => {
    const client = makeMockClient(undefined, { data: null, error: null });
    await BusinessService.cancelSubscription('org-1', client);
    expect(client.rpc).toHaveBeenCalledWith('cancel_organization_subscription', { p_organization_id: 'org-1' });
  });

  it('throws when the RPC rejects (e.g. caller is not the owner)', async () => {
    const client = makeMockClient(undefined, { data: null, error: { message: 'Only the owner can cancel the business subscription' } });
    await expect(BusinessService.cancelSubscription('org-1', client)).rejects.toBeTruthy();
  });
});
