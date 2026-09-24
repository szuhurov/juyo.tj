import { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";

/**
 * Phase 9 — Analytics & Reporting. Every RPC below is a thin wrapper: the
 * server derives scope from get_auth_id()/organization membership, never
 * from a client-supplied user/org/branch/role. See
 * supabase/migrations/20260930000002_analytics_foundation.sql and
 * 20260930000003_analytics_rpcs.sql (Web-tree authoritative).
 */

export interface TrendPoint {
  day: string;
  count: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface CityCount {
  city: string;
  count: number;
}

export interface BranchCount {
  branchId: string;
  branchName: string;
  count: number;
}

export interface UserAnalyticsSummary {
  totalPosts: number;
  lostPosts: number;
  foundPosts: number;
  activePosts: number;
  resolvedPosts: number;
  organizationAttachedPosts: number;
  expiredPosts: number;
  savedItemsCount: number;
  matchesReceived: number;
  activityTrend: TrendPoint[];
}

export interface OrganizationAnalyticsEntitlement {
  basicAnalytics: boolean;
  advancedAnalytics: boolean;
  maxDays: number;
  canExport: boolean;
  branchDetailAllowed: boolean;
}

export interface OrganizationAnalyticsSummary {
  totalPosts: number;
  lostPosts: number;
  foundPosts: number;
  entitlement: OrganizationAnalyticsEntitlement;
  // Everything below is undefined when entitlement.basicAnalytics is false.
  organizationOwnedFoundPosts?: number;
  organizationAssociatedPosts?: number;
  pendingReviews?: number;
  approvedReviews?: number;
  rejectedReviews?: number;
  activeItems?: number;
  resolvedItems?: number;
  staffCreatedItems?: number;
  expiredItems?: number;
  deletedItems?: number;
  itemsByCity?: CityCount[];
  itemsByCategory?: CategoryCount[];
  itemsByBranch?: BranchCount[];
  aiMatches?: number;
  activityTrend?: TrendPoint[];
}

export const AnalyticsService = {
  async getMyAnalyticsSummary(days: number | null = 30, client?: SupabaseClient): Promise<UserAnalyticsSummary> {
    const { data, error } = await (client || supabase).rpc("get_my_analytics_summary", { p_days: days });
    if (error) throw error;
    return data as UserAnalyticsSummary;
  },

  async getOrganizationAnalyticsSummary(
    organizationId: string,
    branchId?: string,
    days?: number,
    client?: SupabaseClient,
  ): Promise<OrganizationAnalyticsSummary> {
    const { data, error } = await (client || supabase).rpc("get_organization_analytics_summary", {
      p_organization_id: organizationId,
      p_branch_id: branchId ?? null,
      p_days: days ?? null,
    });
    if (error) throw error;
    return data as OrganizationAnalyticsSummary;
  },

  async recordAuditEvent(
    eventType: "admin_report_accessed" | "export_generated",
    scope: "user" | "organization" | "branch" | "admin",
    scopeId?: string,
    metadata?: Record<string, unknown>,
    client?: SupabaseClient,
  ): Promise<void> {
    const { error } = await (client || supabase).rpc("record_analytics_audit_event", {
      p_event_type: eventType,
      p_scope: scope,
      p_scope_id: scopeId ?? null,
      p_metadata: metadata ?? {},
    });
    if (error) throw error;
  },
};
