import { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";

/**
 * JUYO for Business — plan/subscription/entitlement layer for
 * ORGANIZATIONS (see supabase/migrations/20260928000000_business_plans.sql).
 * Deliberately a SEPARATE file/service from vip-service.ts: personal
 * VIP/VVIP is USER -> plan, this is ORGANIZATION -> plan — no shared
 * table, no shared RPC, no shared types. Every write here is a thin RPC
 * wrapper; plan/price/limits/status are never client-supplied, only ever
 * read back from what the server resolved.
 */

export type BusinessTier = "free" | "business" | "business_pro" | "enterprise";
export type BillingInterval = "monthly" | "annual" | "custom";
export type OrganizationSubscriptionStatus =
  | "pending" | "trialing" | "active" | "past_due" | "cancelled" | "expired" | "suspended";

export interface BusinessPlan {
  id: string;
  tier: BusinessTier;
  name: string;
  isCustom: boolean;
}

export interface BusinessPlanPrice {
  planId: string;
  billingInterval: BillingInterval;
  /** null for Enterprise/custom — no fixed public price. */
  priceAmount: number | null;
  currency: string;
}

export interface BusinessPlanLimit {
  planId: string;
  /** 'max_branches' | 'max_staff' | 'max_active_items' (numeric caps, null = unlimited)
   *  or a feature flag key ('ai_matching'|'advanced_ai'|'basic_analytics'|
   *  'advanced_analytics'|'reports'|'priority_support', 1/0). */
  limitKey: string;
  limitValue: number | null;
}

export interface OrganizationBusinessPlan {
  subscriptionId: string;
  planTier: BusinessTier;
  planName: string;
  billingInterval: BillingInterval;
  status: OrganizationSubscriptionStatus;
  isCustom: boolean;
  trialEndsAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Resolved limits for this org's CURRENT plan — custom_limits when
   *  is_custom, else the plan's business_plan_limits. Keys match
   *  BusinessPlanLimit.limitKey. */
  limits: Record<string, number | null>;
}

export interface OrganizationUsage {
  branches: number;
  staff: number;
}

export interface OrganizationLimitStatus {
  limit: number | null;
  usage: number;
  exceeded: boolean;
}

interface PlanRow {
  id: string;
  tier: BusinessTier;
  name: string;
  is_custom: boolean;
}

interface PlanPriceRow {
  plan_id: string;
  billing_interval: BillingInterval;
  price_amount: number | string | null;
  currency: string;
}

interface PlanLimitRow {
  plan_id: string;
  limit_key: string;
  limit_value: number | null;
}

interface OrgPlanRow {
  subscription_id: string;
  plan_tier: BusinessTier;
  plan_name: string;
  billing_interval: BillingInterval;
  status: OrganizationSubscriptionStatus;
  is_custom: boolean;
  trial_ends_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  limits: Record<string, number | null>;
}

export const BusinessService = {
  /** Public catalog — direct table reads (business_plans/business_plan_prices/
   *  business_plan_limits all have a permissive public-read RLS policy,
   *  same shape as vip_plans), not RPCs, since pricing must be visible to a
   *  logged-out visitor. */
  async getPlans(client?: SupabaseClient): Promise<BusinessPlan[]> {
    const { data, error } = await (client || supabase)
      .from("business_plans")
      .select("id, tier, name, is_custom")
      .eq("is_active", true);
    if (error) throw error;
    return ((data ?? []) as PlanRow[]).map((r) => ({ id: r.id, tier: r.tier, name: r.name, isCustom: r.is_custom }));
  },

  async getPlanPrices(client?: SupabaseClient): Promise<BusinessPlanPrice[]> {
    const { data, error } = await (client || supabase)
      .from("business_plan_prices")
      .select("plan_id, billing_interval, price_amount, currency")
      .eq("is_active", true);
    if (error) throw error;
    return ((data ?? []) as PlanPriceRow[]).map((r) => ({
      planId: r.plan_id,
      billingInterval: r.billing_interval,
      priceAmount: r.price_amount === null ? null : Number(r.price_amount),
      currency: r.currency,
    }));
  },

  async getPlanLimits(client?: SupabaseClient): Promise<BusinessPlanLimit[]> {
    const { data, error } = await (client || supabase)
      .from("business_plan_limits")
      .select("plan_id, limit_key, limit_value");
    if (error) throw error;
    return ((data ?? []) as PlanLimitRow[]).map((r) => ({ planId: r.plan_id, limitKey: r.limit_key, limitValue: r.limit_value }));
  },

  /** The organization's current plan/subscription/resolved limits. Caller
   *  must be a member. */
  async getOrganizationBusinessPlan(organizationId: string, client?: SupabaseClient): Promise<OrganizationBusinessPlan | null> {
    const { data, error } = await (client || supabase).rpc("get_organization_business_plan", {
      p_organization_id: organizationId,
    });
    if (error) throw error;
    const row = (data as OrgPlanRow[] | null)?.[0];
    if (!row) return null;
    return {
      subscriptionId: row.subscription_id,
      planTier: row.plan_tier,
      planName: row.plan_name,
      billingInterval: row.billing_interval,
      status: row.status,
      isCustom: row.is_custom,
      trialEndsAt: row.trial_ends_at,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      limits: row.limits ?? {},
    };
  },

  async getOrganizationUsage(organizationId: string, client?: SupabaseClient): Promise<OrganizationUsage> {
    const { data, error } = await (client || supabase).rpc("get_organization_usage", { p_organization_id: organizationId });
    if (error) throw error;
    return (data ?? { branches: 0, staff: 0 }) as OrganizationUsage;
  },

  /** Downgrade safety — never used to delete anything, only to surface
   *  whether the org currently exceeds its plan's caps. */
  async getOrganizationLimitStatus(
    organizationId: string,
    client?: SupabaseClient,
  ): Promise<{ maxBranches: OrganizationLimitStatus; maxStaff: OrganizationLimitStatus }> {
    const { data, error } = await (client || supabase).rpc("get_organization_limit_status", { p_organization_id: organizationId });
    if (error) throw error;
    const result = (data ?? {}) as { max_branches?: OrganizationLimitStatus; max_staff?: OrganizationLimitStatus };
    return {
      maxBranches: result.max_branches ?? { limit: null, usage: 0, exceeded: false },
      maxStaff: result.max_staff ?? { limit: null, usage: 0, exceeded: false },
    };
  },

  async canCreateBranch(organizationId: string, client?: SupabaseClient): Promise<boolean> {
    const { data, error } = await (client || supabase).rpc("can_create_branch", { p_organization_id: organizationId });
    if (error) throw error;
    return !!data;
  },

  async canAddStaff(organizationId: string, client?: SupabaseClient): Promise<boolean> {
    const { data, error } = await (client || supabase).rpc("can_add_staff", { p_organization_id: organizationId });
    if (error) throw error;
    return !!data;
  },

  async canUseAiMatching(organizationId: string, client?: SupabaseClient): Promise<boolean> {
    const { data, error } = await (client || supabase).rpc("can_use_ai_matching", { p_organization_id: organizationId });
    if (error) throw error;
    return !!data;
  },

  async canUseAdvancedAnalytics(organizationId: string, client?: SupabaseClient): Promise<boolean> {
    const { data, error } = await (client || supabase).rpc("can_use_advanced_analytics", { p_organization_id: organizationId });
    if (error) throw error;
    return !!data;
  },

  async canAccessBusinessReports(organizationId: string, client?: SupabaseClient): Promise<boolean> {
    const { data, error } = await (client || supabase).rpc("can_access_business_reports", { p_organization_id: organizationId });
    if (error) throw error;
    return !!data;
  },

  async hasFeature(organizationId: string, featureKey: string, client?: SupabaseClient): Promise<boolean> {
    const { data, error } = await (client || supabase).rpc("has_organization_feature", {
      p_organization_id: organizationId,
      p_feature_key: featureKey,
    });
    if (error) throw error;
    return !!data;
  },

  /** Owner-only self-service cancel — no payment provider exists yet, so
   *  there is nothing to refund; this only stops the plan being "current"
   *  going forward (see the migration's cancel_organization_subscription
   *  comment). */
  async cancelSubscription(organizationId: string, client?: SupabaseClient): Promise<void> {
    const { error } = await (client || supabase).rpc("cancel_organization_subscription", { p_organization_id: organizationId });
    if (error) throw error;
  },
};
