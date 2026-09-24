import { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";

/**
 * Phase 5 — AI Matching. Read-only from the client's point of view: every
 * row here comes from a SECURITY DEFINER RPC (see
 * supabase/migrations/20260924000000_ai_matching.sql) — there is no
 * client-callable write. Scores/reasons are computed entirely server-side
 * by run_ai_matching_for_item, triggered automatically when an item is
 * (re)approved; nothing here can create, edit, or influence a match.
 */

export type MatchReason =
  | "same_category"
  | "similar_title"
  | "similar_description"
  | "similar_image"
  | "same_city"
  | "similar_date";

export interface PossibleMatch {
  matchId: string;
  myItemId: string;
  myItemTitle: string;
  myItemType: "lost" | "found";
  otherItemId: string;
  otherItemTitle: string;
  otherItemType: "lost" | "found";
  otherItemImageUrl: string | null;
  otherPosterId: string;
  otherPosterName: string | null;
  otherPosterAvatar: string | null;
  score: number;
  reasons: MatchReason[];
  createdAt: string;
}

interface PossibleMatchRow {
  match_id: string;
  my_item_id: string;
  my_item_title: string | null;
  my_item_type: "lost" | "found";
  other_item_id: string;
  other_item_title: string | null;
  other_item_type: "lost" | "found";
  other_item_image_url: string | null;
  other_poster_id: string;
  other_poster_first_name: string | null;
  other_poster_last_name: string | null;
  other_poster_avatar_url: string | null;
  score: number | string;
  reasons: MatchReason[] | null;
  created_at: string;
}

function mapRow(row: PossibleMatchRow): PossibleMatch {
  return {
    matchId: row.match_id,
    myItemId: row.my_item_id,
    myItemTitle: row.my_item_title ?? "",
    myItemType: row.my_item_type,
    otherItemId: row.other_item_id,
    otherItemTitle: row.other_item_title ?? "",
    otherItemType: row.other_item_type,
    otherItemImageUrl: row.other_item_image_url,
    otherPosterId: row.other_poster_id,
    otherPosterName: `${row.other_poster_first_name ?? ""} ${row.other_poster_last_name ?? ""}`.trim() || null,
    otherPosterAvatar: row.other_poster_avatar_url,
    score: Math.round(Number(row.score)),
    reasons: row.reasons ?? [],
    createdAt: row.created_at,
  };
}

export const MatchService = {
  async getMyPossibleMatches(limit = 30, client?: SupabaseClient): Promise<PossibleMatch[]> {
    const { data, error } = await (client || supabase).rpc("get_my_possible_matches", { p_limit: limit });
    if (error) throw error;
    return ((data ?? []) as PossibleMatchRow[]).map(mapRow);
  },

  /** A match is dismissed the same way any other notification is — through
   *  dismiss_notification with kind='ai_match', ref_id=matchId. There is no
   *  separate matches-only dismiss RPC; reusing the Phase 4 mechanism is the
   *  point. */
  async dismiss(match: PossibleMatch, client?: SupabaseClient): Promise<void> {
    const { error } = await (client || supabase).rpc("dismiss_notification", {
      p_kind: "ai_match",
      p_ref_id: match.matchId,
      p_item_id: match.myItemId,
      p_item_title: match.myItemTitle,
      p_related_name: match.otherPosterName,
      p_related_avatar: match.otherPosterAvatar,
      p_status: null,
    });
    if (error) throw error;
  },
};
