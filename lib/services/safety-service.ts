import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Report + block — tables and RLS in
 * supabase/migrations/20261001000001_reports_and_blocks.sql. Mirrors
 * app/lib/services/safety-service.ts (mobile). Every call runs as the signed-in
 * user: RLS only allows inserting your own report and managing your own block
 * list; the reported user is derived from the listing on the server.
 */

export const REPORT_REASONS = ["spam", "scam", "offensive", "personal_info", "fake", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

const UNIQUE_VIOLATION = "23505";

export async function reportItem(
  db: SupabaseClient,
  reporterId: string,
  itemId: string,
  reason: ReportReason,
  details: string,
): Promise<"sent" | "already"> {
  const { error } = await db.from("content_reports").insert({
    reporter_id: reporterId,
    item_id: itemId,
    reason,
    details: details.trim().slice(0, 1000) || null,
  });
  if (error?.code === UNIQUE_VIOLATION) return "already";
  if (error) throw error;
  return "sent";
}

export async function blockUser(db: SupabaseClient, blockerId: string, blockedId: string): Promise<void> {
  const { error } = await db.from("user_blocks").insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error && error.code !== UNIQUE_VIOLATION) throw error;
}

export async function unblockUser(db: SupabaseClient, blockerId: string, blockedId: string): Promise<void> {
  const { error } = await db.from("user_blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId);
  if (error) throw error;
}

export async function fetchBlockedIds(db: SupabaseClient, blockerId: string): Promise<Set<string>> {
  const { data, error } = await db.from("user_blocks").select("blocked_id").eq("blocker_id", blockerId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.blocked_id as string));
}

interface PublicProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface BlockedUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export async function fetchBlockedUsers(db: SupabaseClient, blockerId: string): Promise<BlockedUser[]> {
  const { data, error } = await db
    .from("user_blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", blockerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.blocked_id as string);
  if (ids.length === 0) return [];
  // `profiles` is owner-only (RLS); `public_profiles` is the safe public view (no phone).
  const { data: profiles } = await db.from("public_profiles").select("id, first_name, last_name, avatar_url").in("id", ids);
  const byId = new Map(((profiles ?? []) as PublicProfileRow[]).map((p) => [p.id, p]));
  return ids.map((id) => {
    const p = byId.get(id);
    return {
      id,
      name: [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim(),
      avatarUrl: p?.avatar_url ?? null,
    };
  });
}
