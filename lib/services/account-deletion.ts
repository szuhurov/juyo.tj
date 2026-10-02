import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorStatus } from "@/lib/error-utils";

function extractStoragePath(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  try {
    const parts = new URL(imageUrl).pathname.split("/public/items/");
    return parts.length > 1 ? parts[1] : null;
  } catch {
    const parts = imageUrl.split("/public/items/");
    return parts.length > 1 ? parts[1].split("?")[0] : null;
  }
}

const ITEM_FIELDS = "id, title, category, type, is_resolved, moderation_status, created_at, images:item_images(image_url, thumbnail_url)";

/**
 * Fully deletes an account (Clerk + Supabase + storage). No copy is kept:
 * the owner decided (2026-10-01) that deleted accounts are not archived, and
 * the privacy policy says so — used both by the user themself
 * (/api/account/delete) and by admin (after approving a /delete-account
 * request). A single piece of logic, so the two don't drift apart.
 */
export async function deleteUserAccount(userId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: profile, error } = await supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!profile) return { ok: true };

  const client = await clerkClient();
  try {
    await client.users.deleteUser(userId);
  } catch (clerkErr) {
    if (getErrorStatus(clerkErr) !== 404) throw clerkErr;
  }

  // Only needed to find the photos to remove from storage.
  const { data: items } = await supabaseAdmin.from("items").select(ITEM_FIELDS).eq("user_id", userId);

  const storagePaths: string[] = [];
  for (const item of items ?? []) {
    const itemImages = (item as { images?: { image_url: string; thumbnail_url: string | null }[] }).images ?? [];
    for (const img of itemImages) {
      for (const url of [img.image_url, img.thumbnail_url]) {
        const path = extractStoragePath(url);
        if (path) storagePaths.push(path);
      }
    }
  }
  const avatarPath = extractStoragePath(profile.avatar_url);
  if (avatarPath) storagePaths.push(avatarPath);
  if (storagePaths.length > 0) {
    await supabaseAdmin.storage.from("items").remove(storagePaths);
  }

  await supabaseAdmin.from("push_tokens").delete().eq("user_id", userId);
  // Tables keyed by user_id without an FK to profiles — not removed by the cascade.
  await Promise.all(
    ["push_notification_log", "notification_reads", "dismissed_notifications", "deleted_notifications_archive", "subscriptions"].map(
      (table) => supabaseAdmin.from(table).delete().eq("user_id", userId),
    ),
  );
  // Listing history rows outlive the listing (analytics); drop the link to the person.
  await supabaseAdmin.from("item_lifecycle_events").update({ actor_id: null }).eq("actor_id", userId);

  const { error: deleteError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
  if (deleteError) throw deleteError;

  return { ok: true };
}
