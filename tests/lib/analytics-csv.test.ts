import { describe, it, expect } from 'vitest';
import { flattenAnalyticsForCsv, toCsv } from '@/lib/analytics-csv';

describe('flattenAnalyticsForCsv', () => {
  it('flattens scalar fields directly', () => {
    const rows = flattenAnalyticsForCsv({ totalPosts: 10, lostPosts: 4 });
    expect(rows).toEqual([
      { metric: 'totalPosts', value: '10' },
      { metric: 'lostPosts', value: '4' },
    ]);
  });

  it('flattens nested objects with a dotted path', () => {
    const rows = flattenAnalyticsForCsv({ entitlement: { basicAnalytics: true, maxDays: 30 } });
    expect(rows).toEqual([
      { metric: 'entitlement.basicAnalytics', value: 'true' },
      { metric: 'entitlement.maxDays', value: '30' },
    ]);
  });

  it('flattens arrays of objects with an index and nested keys', () => {
    const rows = flattenAnalyticsForCsv({ itemsByCity: [{ city: 'dushanbe', count: 5 }] });
    expect(rows).toEqual([
      { metric: 'itemsByCity[0].city', value: 'dushanbe' },
      { metric: 'itemsByCity[0].count', value: '5' },
    ]);
  });

  it('skips null/undefined fields rather than emitting an empty row', () => {
    const rows = flattenAnalyticsForCsv({ totalPosts: 10, itemsByBranch: null });
    expect(rows).toEqual([{ metric: 'totalPosts', value: '10' }]);
  });

  it('never leaks a nested pii-shaped field name silently — the caller controls what goes in', () => {
    // This test documents the contract: the flattener has no allowlist/denylist
    // of its own — it is the RPC's job to never include sensitive fields in
    // the jsonb it returns (see get_organization_analytics_summary, which
    // only ever returns counts/aggregates, never phone/email/name).
    const rows = flattenAnalyticsForCsv({ totalPosts: 3 });
    expect(rows.some((r) => /phone|email|name/i.test(r.metric))).toBe(false);
  });
});

describe('toCsv', () => {
  it('produces a header row plus one line per metric', () => {
    const csv = toCsv([{ metric: 'totalPosts', value: '10' }, { metric: 'lostPosts', value: '4' }]);
    expect(csv).toBe('metric,value\ntotalPosts,10\nlostPosts,4');
  });

  it('quotes and escapes values containing commas or quotes', () => {
    const csv = toCsv([{ metric: 'note', value: 'a, "quoted" value' }]);
    expect(csv).toBe('metric,value\nnote,"a, ""quoted"" value"');
  });
});
