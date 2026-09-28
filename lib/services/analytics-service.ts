import { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";

/**
 * Phase 9 — Analytics & Reporting. Every RPC below is a thin wrapper: the
 * server derives scope from get_auth_id(), never from a client-supplied
 * user. See supabase/migrations/20260930000002_analytics_foundation.sql and
 * 20260930000003_analytics_rpcs.sql (Web-tree authoritative).
 */

export interface TrendPoint {
  day: string;
  count: number;
}

export interface UserAnalyticsSummary {
  totalPosts: number;
  lostPosts: number;
  foundPosts: number;
  activePosts: number;
  resolvedPosts: number;
  expiredPosts: number;
  savedItemsCount: number;
  matchesReceived: number;
  activityTrend: TrendPoint[];
}

export const AnalyticsService = {
  async getMyAnalyticsSummary(days: number | null = 30, client?: SupabaseClient): Promise<UserAnalyticsSummary> {
    const { data, error } = await (client || supabase).rpc("get_my_analytics_summary", { p_days: days });
    if (error) throw error;
    return data as UserAnalyticsSummary;
  },
};
