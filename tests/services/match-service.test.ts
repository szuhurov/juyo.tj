import { describe, it, expect, vi } from 'vitest';
import { MatchService, type PossibleMatch } from '@/lib/services/match-service';
import type { SupabaseClient } from '@supabase/supabase-js';

const makeMockClient = (rpcResult: { data: any; error: any }) =>
  ({
    rpc: vi.fn().mockResolvedValue(rpcResult),
  }) as unknown as SupabaseClient;

const ROW = {
  match_id: 'm1',
  my_item_id: 'i-mine',
  my_item_title: 'My iPhone',
  my_item_type: 'lost' as const,
  other_item_id: 'i-other',
  other_item_title: 'Found iPhone',
  other_item_type: 'found' as const,
  other_item_image_url: 'https://example.com/x.jpg',
  other_poster_id: 'user_other',
  other_poster_first_name: 'Ali',
  other_poster_last_name: 'Valiev',
  other_poster_avatar_url: null,
  score: '65.00',
  reasons: ['same_category', 'similar_title'],
  created_at: '2026-09-20T00:00:00.000Z',
};

describe('MatchService.getMyPossibleMatches', () => {
  it('calls get_my_possible_matches with the given limit', async () => {
    const client = makeMockClient({ data: [ROW], error: null });
    await MatchService.getMyPossibleMatches(30, client);
    expect(client.rpc).toHaveBeenCalledWith('get_my_possible_matches', { p_limit: 30 });
  });

  it('maps a raw row into a PossibleMatch with a rounded numeric score', async () => {
    const client = makeMockClient({ data: [ROW], error: null });
    const result = await MatchService.getMyPossibleMatches(30, client);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      matchId: 'm1',
      myItemId: 'i-mine',
      otherItemId: 'i-other',
      otherPosterName: 'Ali Valiev',
      score: 65,
      reasons: ['same_category', 'similar_title'],
    });
  });

  it('returns an empty array when the RPC returns null data', async () => {
    const client = makeMockClient({ data: null, error: null });
    const result = await MatchService.getMyPossibleMatches(30, client);
    expect(result).toEqual([]);
  });

  it('throws when the RPC errors', async () => {
    const client = makeMockClient({ data: null, error: { message: 'boom' } });
    await expect(MatchService.getMyPossibleMatches(30, client)).rejects.toBeTruthy();
  });
});

describe('MatchService.dismiss', () => {
  it('calls dismiss_notification with kind=ai_match and the match id as ref_id', async () => {
    const client = makeMockClient({ data: null, error: null });
    const match: PossibleMatch = {
      matchId: 'm1',
      myItemId: 'i-mine',
      myItemTitle: 'My iPhone',
      myItemType: 'lost',
      otherItemId: 'i-other',
      otherItemTitle: 'Found iPhone',
      otherItemType: 'found',
      otherItemImageUrl: null,
      otherPosterId: 'user_other',
      otherPosterName: 'Ali Valiev',
      otherPosterAvatar: null,
      score: 65,
      reasons: ['same_category'],
      createdAt: '2026-09-20T00:00:00.000Z',
    };
    await MatchService.dismiss(match, client);
    expect(client.rpc).toHaveBeenCalledWith(
      'dismiss_notification',
      expect.objectContaining({ p_kind: 'ai_match', p_ref_id: 'm1', p_item_id: 'i-mine' }),
    );
  });
});
