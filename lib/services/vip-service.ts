import { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";

/**
 * Phase 6 — VIP/VVIP. Every write here is a thin wrapper around a
 * SECURITY DEFINER RPC (see supabase/migrations/20260925000000_vip_vvip_subscriptions.sql)
 * — price/duration/status/expires_at are never sent from this file, only a
 * plan id (create) or a subscription id (cancel). Activation/revocation are
 * admin-only server actions, not reachable from here at all.
 */

export type VipTier = "vip" | "vvip";
export type SubscriptionStatus = "pending" | "active" | "expired" | "cancelled" | "revoked";

export interface VipPlan {
  id: string;
  tier: VipTier;
  durationDays: number;
  priceTjs: number;
  currency: string;
}

export interface VipTierBenefit {
  tier: VipTier;
  feedBoostHours: number;
}

export interface MyVipStatus {
  tier: VipTier;
  expiresAt: string;
  subscriptionId: string;
}

export interface MySubscription {
  id: string;
  tier: VipTier;
  durationDays: number;
  priceTjs: number;
  currency: string;
  status: SubscriptionStatus;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
}

interface PlanRow {
  id: string;
  tier: VipTier;
  duration_days: number;
  price_tjs: number | string;
  currency: string;
}

interface BenefitRow {
  tier: VipTier;
  feed_boost_hours: number;
}

interface StatusRow {
  tier: VipTier;
  expires_at: string;
  subscription_id: string;
}

interface SubscriptionRow {
  id: string;
  tier: VipTier;
  duration_days: number;
  price_tjs: number | string;
  currency: string;
  status: SubscriptionStatus;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export const VipService = {
  /** Public pricing — a plain table select (vip_plans has a permissive
   *  public-read RLS policy), not an RPC, since prices must be visible to
   *  a logged-out visitor too. */
  async getPlans(client?: SupabaseClient): Promise<VipPlan[]> {
    const { data, error } = await (client || supabase)
      .from("vip_plans")
      .select("id, tier, duration_days, price_tjs, currency")
      .eq("is_active", true)
      .order("tier")
      .order("duration_days");
    if (error) throw error;
    return ((data ?? []) as PlanRow[]).map((r) => ({
      id: r.id,
      tier: r.tier,
      durationDays: r.duration_days,
      priceTjs: Number(r.price_tjs),
      currency: r.currency,
    }));
  },

  /** Public, PII-free: is the single VVIP slot free, and if not, when it frees up. */
  async getVvipAvailability(client?: SupabaseClient): Promise<{ isAvailable: boolean; availableAt: string | null }> {
    const { data, error } = await (client || supabase).rpc("get_vvip_availability");
    if (error) throw error;
    const row = (data as { is_available: boolean; available_at: string | null }[] | null)?.[0];
    return { isAvailable: row?.is_available ?? true, availableAt: row?.available_at ?? null };
  },

  async getTierBenefits(client?: SupabaseClient): Promise<VipTierBenefit[]> {
    const { data, error } = await (client || supabase).from("vip_tier_benefits").select("tier, feed_boost_hours");
    if (error) throw error;
    return ((data ?? []) as BenefitRow[]).map((r) => ({ tier: r.tier, feedBoostHours: r.feed_boost_hours }));
  },

  async getMyStatus(client?: SupabaseClient): Promise<MyVipStatus | null> {
    const { data, error } = await (client || supabase).rpc("get_my_vip_status");
    if (error) throw error;
    const row = (data as StatusRow[] | null)?.[0];
    if (!row) return null;
    return { tier: row.tier, expiresAt: row.expires_at, subscriptionId: row.subscription_id };
  },

  async getMySubscriptions(limit = 20, client?: SupabaseClient): Promise<MySubscription[]> {
    const { data, error } = await (client || supabase).rpc("get_my_subscriptions", { p_limit: limit });
    if (error) throw error;
    return ((data ?? []) as SubscriptionRow[]).map((r) => ({
      id: r.id,
      tier: r.tier,
      durationDays: r.duration_days,
      priceTjs: Number(r.price_tjs),
      currency: r.currency,
      status: r.status,
      startsAt: r.starts_at,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      cancelledAt: r.cancelled_at,
      cancelReason: r.cancel_reason,
    }));
  },

  /** Starts a purchase — inserts a 'pending' row with no benefit yet. Real
   *  activation happens only after an admin manually confirms payment (no
   *  payment provider is integrated this phase — see the migration's header
   *  comment). Returns the new subscription id. */
  async createSubscription(planId: string, client?: SupabaseClient): Promise<string> {
    const { data, error } = await (client || supabase).rpc("create_subscription", { p_plan_id: planId });
    if (error) throw error;
    return data as string;
  },

  async cancelSubscription(subscriptionId: string, client?: SupabaseClient): Promise<void> {
    const { error } = await (client || supabase).rpc("cancel_subscription", { p_subscription_id: subscriptionId });
    if (error) throw error;
  },
};
