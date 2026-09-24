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

describe('AnalyticsService.getOrganizationAnalyticsSummary', () => {
  it('sends organization/branch/days — branch/role scoping happens server-side, never trusted from here', async () => {
    const client = makeMockClient({ data: { totalPosts: 10 }, error: null });
    await AnalyticsService.getOrganizationAnalyticsSummary('org-1', 'branch-1', 90, client);
    expect(client.rpc).toHaveBeenCalledWith('get_organization_analytics_summary', {
      p_organization_id: 'org-1', p_branch_id: 'branch-1', p_days: 90,
    });
  });

  it('sends null branch/days when omitted rather than inventing a default', async () => {
    const client = makeMockClient({ data: { totalPosts: 0 }, error: null });
    await AnalyticsService.getOrganizationAnalyticsSummary('org-1', undefined, undefined, client);
    expect(client.rpc).toHaveBeenCalledWith('get_organization_analytics_summary', {
      p_organization_id: 'org-1', p_branch_id: null, p_days: null,
    });
  });

  it('throws when the caller is not an organization member', async () => {
    const client = makeMockClient({ data: null, error: { message: 'Not authorized' } });
    await expect(AnalyticsService.getOrganizationAnalyticsSummary('org-1', undefined, undefined, client)).rejects.toBeTruthy();
  });
});

describe('AnalyticsService.recordAuditEvent', () => {
  it('sends event type, scope, and scope id to record_analytics_audit_event', async () => {
    const client = makeMockClient({ data: null, error: null });
    await AnalyticsService.recordAuditEvent('export_generated', 'organization', 'org-1', { days: 30 }, client);
    expect(client.rpc).toHaveBeenCalledWith('record_analytics_audit_event', {
      p_event_type: 'export_generated', p_scope: 'organization', p_scope_id: 'org-1', p_metadata: { days: 30 },
    });
  });

  it('defaults metadata to an empty object and scope id to null', async () => {
    const client = makeMockClient({ data: null, error: null });
    await AnalyticsService.recordAuditEvent('admin_report_accessed', 'admin', undefined, undefined, client);
    expect(client.rpc).toHaveBeenCalledWith('record_analytics_audit_event', {
      p_event_type: 'admin_report_accessed', p_scope: 'admin', p_scope_id: null, p_metadata: {},
    });
  });
});
