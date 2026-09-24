import { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";

/**
 * Phase 7 — Organization post routing: a normal user attaching an
 * organization to their LOST/FOUND post (unchanged ownership), and
 * organizations creating their own FOUND posts. See
 * supabase/migrations/20260929000000_organization_item_routing.sql.
 *
 * "Organization Approved" here means only "this organization confirms the
 * post relates to them" — never ownership verification, never Claim/
 * Verification. Every write is a thin RPC wrapper; organization_review_status
 * is never client-settable (enforced server-side by a trigger + these RPCs).
 */

export type OrganizationReviewStatus = "none" | "pending" | "approved" | "rejected";

export interface CompatibleOrganization {
  id: string;
  name: string;
  category: string;
}

export interface OrganizationBranchOption {
  id: string;
  name: string;
  city: string | null;
}

export interface OrganizationReviewQueueItem {
  itemId: string;
  title: string;
  category: string;
  type: "lost" | "found";
  city: string | null;
  branchId: string | null;
  isOrganizationOwned: boolean;
  createdAt: string;
}

interface CompatibleOrgRow {
  id: string;
  name: string;
  category: string;
}

interface BranchOptionRow {
  id: string;
  name: string;
  city: string | null;
}

interface ReviewQueueRow {
  item_id: string;
  title: string;
  category: string;
  type: "lost" | "found";
  city: string | null;
  branch_id: string | null;
  is_organization_owned: boolean;
  created_at: string;
}

export const OrganizationItemService = {
  /** Feeds the "Organization" picker on the add-item form — active orgs
   *  whose category is compatible with the chosen place type (location_type),
   *  optionally narrowed by city. No membership required. */
  async getCompatibleOrganizations(locationType: string, city?: string, client?: SupabaseClient): Promise<CompatibleOrganization[]> {
    const { data, error } = await (client || supabase).rpc("get_compatible_organizations", {
      p_location_type: locationType,
      p_city: city ?? null,
    });
    if (error) throw error;
    return ((data ?? []) as CompatibleOrgRow[]).map((r) => ({ id: r.id, name: r.name, category: r.category }));
  },

  async getOrganizationBranchesForPicker(organizationId: string, city?: string, client?: SupabaseClient): Promise<OrganizationBranchOption[]> {
    const { data, error } = await (client || supabase).rpc("get_organization_branches_for_picker", {
      p_organization_id: organizationId,
      p_city: city ?? null,
    });
    if (error) throw error;
    return ((data ?? []) as BranchOptionRow[]).map((r) => ({ id: r.id, name: r.name, city: r.city }));
  },

  /** Staff review queue — owner/admin (org-wide) or branch_manager (own
   *  branch only, server-enforced). */
  async getReviewQueue(organizationId: string, branchId?: string, client?: SupabaseClient): Promise<OrganizationReviewQueueItem[]> {
    const { data, error } = await (client || supabase).rpc("get_organization_review_queue", {
      p_organization_id: organizationId,
      p_branch_id: branchId ?? null,
    });
    if (error) throw error;
    return ((data ?? []) as ReviewQueueRow[]).map((r) => ({
      itemId: r.item_id,
      title: r.title,
      category: r.category,
      type: r.type,
      city: r.city,
      branchId: r.branch_id,
      isOrganizationOwned: r.is_organization_owned,
      createdAt: r.created_at,
    }));
  },

  async approvePost(itemId: string, client?: SupabaseClient): Promise<void> {
    const { error } = await (client || supabase).rpc("approve_organization_post", { p_item_id: itemId });
    if (error) throw error;
  },

  async rejectPost(itemId: string, reason?: string, client?: SupabaseClient): Promise<void> {
    const { error } = await (client || supabase).rpc("reject_organization_post", { p_item_id: itemId, p_reason: reason ?? null });
    if (error) throw error;
  },

  /** Organization-owned FOUND post. user_id stays null server-side; the
   *  creating staff member is recorded only as an audit reference, never
   *  as the owner. Requires staff+ in the target branch. */
  async createOrganizationFoundItem(
    params: {
      organizationId: string;
      branchId: string;
      title: string;
      description: string;
      category: string;
      date: string;
      city: string;
      locationType?: string;
      reward?: string;
      imageUrls?: string[];
    },
    client?: SupabaseClient,
  ): Promise<string> {
    const { data, error } = await (client || supabase).rpc("create_organization_found_item", {
      p_organization_id: params.organizationId,
      p_branch_id: params.branchId,
      p_title: params.title,
      p_description: params.description,
      p_category: params.category,
      p_date: params.date,
      p_city: params.city,
      p_location_type: params.locationType ?? null,
      p_reward: params.reward ?? null,
      p_image_urls: params.imageUrls ?? [],
    });
    if (error) throw error;
    return data as string;
  },
};
