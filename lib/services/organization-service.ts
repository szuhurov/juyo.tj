import { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";

/**
 * Phase 7A — B2B Organizations (foundation only: org, branch, membership,
 * RBAC). Every write here is a thin wrapper around a SECURITY DEFINER RPC
 * (see supabase/migrations/20260926000000_organizations_core.sql) — role,
 * organization_id, and branch_id are never trusted from anywhere in this
 * file; every RPC re-derives the caller's identity and membership
 * server-side. No invitations, no inventory, no organization-owned items
 * yet — those are later Phase 7 steps.
 */

export type OrganizationStatus = "pending" | "active" | "suspended" | "archived";
export type OrganizationVerificationStatus = "unverified" | "verified" | "rejected";
export type OrganizationRole = "owner" | "admin" | "branch_manager" | "staff" | "viewer";

export interface MyOrganization {
  organizationId: string;
  name: string;
  category: string;
  status: OrganizationStatus;
  role: OrganizationRole;
  branchId: string | null;
}

export interface OrganizationDetail {
  id: string;
  name: string;
  category: string;
  status: OrganizationStatus;
  verificationStatus: OrganizationVerificationStatus;
  defaultBranchId: string | null;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  branchId: string | null;
  userId: string;
  role: OrganizationRole;
  status: "active" | "removed";
  createdAt: string;
}

export interface ManagedBranch {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  status: "active" | "archived";
  isDefault: boolean;
  createdAt: string;
}

interface ManagedBranchRow {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  status: "active" | "archived";
  is_default: boolean;
  created_at: string;
}

export type InvitationRole = Exclude<OrganizationRole, "owner">;
export type InvitationStatus = "pending" | "accepted" | "rejected" | "revoked" | "expired";

export interface MyInvitation {
  id: string;
  organizationId: string;
  organizationName: string;
  branchId: string | null;
  branchName: string | null;
  role: InvitationRole;
  invitedBy: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface OrgInvitation {
  id: string;
  branchId: string | null;
  invitedUserId: string;
  role: InvitationRole;
  invitedBy: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

interface MyOrganizationRow {
  organization_id: string;
  name: string;
  category: string;
  status: OrganizationStatus;
  role: OrganizationRole;
  branch_id: string | null;
}

interface OrganizationDetailRow {
  id: string;
  name: string;
  category: string;
  status: OrganizationStatus;
  verification_status: OrganizationVerificationStatus;
  default_branch_id: string | null;
  created_at: string;
}

interface OrganizationMemberRow {
  id: string;
  branch_id: string | null;
  user_id: string;
  role: OrganizationRole;
  status: "active" | "removed";
  created_at: string;
}

interface MyInvitationRow {
  id: string;
  organization_id: string;
  organization_name: string;
  branch_id: string | null;
  branch_name: string | null;
  role: InvitationRole;
  invited_by: string;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
}

interface OrgInvitationRow {
  id: string;
  branch_id: string | null;
  invited_user_id: string;
  role: InvitationRole;
  invited_by: string;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
}

export const OrganizationService = {
  async createOrganization(name: string, category: string, client?: SupabaseClient): Promise<string> {
    const { data, error } = await (client || supabase).rpc("create_organization", {
      p_name: name,
      p_category: category,
    });
    if (error) throw error;
    return data as string;
  },

  async getMyOrganizations(client?: SupabaseClient): Promise<MyOrganization[]> {
    const { data, error } = await (client || supabase).rpc("get_my_organizations");
    if (error) throw error;
    return ((data ?? []) as MyOrganizationRow[]).map((r) => ({
      organizationId: r.organization_id,
      name: r.name,
      category: r.category,
      status: r.status,
      role: r.role,
      branchId: r.branch_id,
    }));
  },

  async getOrganization(organizationId: string, client?: SupabaseClient): Promise<OrganizationDetail | null> {
    const { data, error } = await (client || supabase).rpc("get_organization", { p_organization_id: organizationId });
    if (error) throw error;
    const row = (data as OrganizationDetailRow[] | null)?.[0];
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      status: row.status,
      verificationStatus: row.verification_status,
      defaultBranchId: row.default_branch_id,
      createdAt: row.created_at,
    };
  },

  async getOrgMembers(organizationId: string, client?: SupabaseClient): Promise<OrganizationMember[]> {
    const { data, error } = await (client || supabase).rpc("get_org_members", { p_organization_id: organizationId });
    if (error) throw error;
    return ((data ?? []) as OrganizationMemberRow[]).map((r) => ({
      id: r.id,
      branchId: r.branch_id,
      userId: r.user_id,
      role: r.role,
      status: r.status,
      createdAt: r.created_at,
    }));
  },

  /** Owner/admin-only management listing — every branch regardless of
   *  status (unlike getOrganizationBranchesForPicker in
   *  organization-item-service.ts, which is active-only and meant for
   *  post-creation pickers, not management). */
  async getOrgBranches(organizationId: string, client?: SupabaseClient): Promise<ManagedBranch[]> {
    const { data, error } = await (client || supabase).rpc("get_org_branches", { p_organization_id: organizationId });
    if (error) throw error;
    return ((data ?? []) as ManagedBranchRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      address: r.address,
      status: r.status,
      isDefault: r.is_default,
      createdAt: r.created_at,
    }));
  },

  async createBranch(
    organizationId: string,
    name: string,
    city?: string,
    address?: string,
    client?: SupabaseClient,
  ): Promise<string> {
    const { data, error } = await (client || supabase).rpc("create_branch", {
      p_organization_id: organizationId,
      p_name: name,
      p_city: city ?? null,
      p_address: address ?? null,
    });
    if (error) throw error;
    return data as string;
  },

  async updateBranch(
    branchId: string,
    fields: { name?: string; city?: string; address?: string },
    client?: SupabaseClient,
  ): Promise<void> {
    const { error } = await (client || supabase).rpc("update_branch", {
      p_branch_id: branchId,
      p_name: fields.name ?? null,
      p_city: fields.city ?? null,
      p_address: fields.address ?? null,
    });
    if (error) throw error;
  },

  /** Archiving a branch with active members requires reassigning them in
   *  the same call (server-enforced — see the migration comment on
   *  archive_branch) — they can never be silently left on an archived
   *  branch. Omit `reassignMembersTo` only when the branch has no active
   *  members. */
  async archiveBranch(branchId: string, reassignMembersTo?: string, client?: SupabaseClient): Promise<void> {
    const { error } = await (client || supabase).rpc("archive_branch", {
      p_branch_id: branchId,
      p_reassign_members_to: reassignMembersTo ?? null,
    });
    if (error) throw error;
  },

  async changeMemberBranch(organizationId: string, memberId: string, newBranchId: string, client?: SupabaseClient): Promise<void> {
    const { error } = await (client || supabase).rpc("change_member_branch", {
      p_organization_id: organizationId,
      p_member_id: memberId,
      p_new_branch_id: newBranchId,
    });
    if (error) throw error;
  },

  async leaveOrganization(organizationId: string, client?: SupabaseClient): Promise<void> {
    const { error } = await (client || supabase).rpc("leave_organization", { p_organization_id: organizationId });
    if (error) throw error;
  },

  /** Invites an EXISTING JUYO user (by Clerk id) — no email/SMS, no
   *  unknown-contact resolution, per Phase 7B scope. 'owner' is excluded
   *  from the type — ownership only ever moves via transferOwnership. */
  async inviteMember(
    organizationId: string,
    invitedUserId: string,
    role: InvitationRole,
    branchId?: string,
    client?: SupabaseClient,
  ): Promise<string> {
    const { data, error } = await (client || supabase).rpc("invite_organization_member", {
      p_organization_id: organizationId,
      p_invited_user_id: invitedUserId,
      p_role: role,
      p_branch_id: branchId ?? null,
    });
    if (error) throw error;
    return data as string;
  },

  async getMyInvitations(client?: SupabaseClient): Promise<MyInvitation[]> {
    const { data, error } = await (client || supabase).rpc("get_my_invitations");
    if (error) throw error;
    return ((data ?? []) as MyInvitationRow[]).map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      organizationName: r.organization_name,
      branchId: r.branch_id,
      branchName: r.branch_name,
      role: r.role,
      invitedBy: r.invited_by,
      status: r.status,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    }));
  },

  async getOrgInvitations(organizationId: string, client?: SupabaseClient): Promise<OrgInvitation[]> {
    const { data, error } = await (client || supabase).rpc("get_org_invitations", { p_organization_id: organizationId });
    if (error) throw error;
    return ((data ?? []) as OrgInvitationRow[]).map((r) => ({
      id: r.id,
      branchId: r.branch_id,
      invitedUserId: r.invited_user_id,
      role: r.role,
      invitedBy: r.invited_by,
      status: r.status,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    }));
  },

  async acceptInvitation(invitationId: string, client?: SupabaseClient): Promise<void> {
    const { error } = await (client || supabase).rpc("accept_organization_invitation", { p_invitation_id: invitationId });
    if (error) throw error;
  },

  async rejectInvitation(invitationId: string, client?: SupabaseClient): Promise<void> {
    const { error } = await (client || supabase).rpc("reject_organization_invitation", { p_invitation_id: invitationId });
    if (error) throw error;
  },

  async revokeInvitation(invitationId: string, client?: SupabaseClient): Promise<void> {
    const { error } = await (client || supabase).rpc("revoke_invitation", { p_invitation_id: invitationId });
    if (error) throw error;
  },

  async changeMemberRole(
    organizationId: string,
    memberId: string,
    newRole: Exclude<OrganizationRole, "owner">,
    branchId?: string,
    client?: SupabaseClient,
  ): Promise<void> {
    const { error } = await (client || supabase).rpc("change_member_role", {
      p_organization_id: organizationId,
      p_member_id: memberId,
      p_new_role: newRole,
      p_branch_id: branchId ?? null,
    });
    if (error) throw error;
  },

  async removeMember(organizationId: string, memberId: string, client?: SupabaseClient): Promise<void> {
    const { error } = await (client || supabase).rpc("remove_organization_member", {
      p_organization_id: organizationId,
      p_member_id: memberId,
    });
    if (error) throw error;
  },

  async transferOwnership(organizationId: string, newOwnerUserId: string, client?: SupabaseClient): Promise<void> {
    const { error } = await (client || supabase).rpc("transfer_organization_ownership", {
      p_organization_id: organizationId,
      p_new_owner_user_id: newOwnerUserId,
    });
    if (error) throw error;
  },

  async archiveOrganization(organizationId: string, client?: SupabaseClient): Promise<void> {
    const { error } = await (client || supabase).rpc("archive_organization", { p_organization_id: organizationId });
    if (error) throw error;
  },
};
