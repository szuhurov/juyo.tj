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

const ITEM_FIELDS = "id, title, category, type, is_resolved, moderation_status, created_at, images:item_images(image_url)";

/**
 * Fully deletes an account (Clerk + Supabase + storage), with a snapshot
 * saved to the archive before deletion — used both by the user themself
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

  const [{ data: items }, { data: savedItems }] = await Promise.all([
    supabaseAdmin.from("items").select(ITEM_FIELDS).eq("user_id", userId),
    supabaseAdmin
      .from("saved_items")
      .select(`item_id, created_at, items(${ITEM_FIELDS})`)
      .eq("user_id", userId),
  ]);

  const snapshot = {
    profile,
    items: items ?? [],
    savedItems: savedItems ?? [],
  };

  await supabaseAdmin.from("deleted_accounts_archive").insert([
    {
      user_id: userId,
      profile_snapshot: snapshot,
      items_count: (items ?? []).length,
    },
  ]);

  if ((items ?? []).length > 0) {
    await supabaseAdmin.from("deleted_items_archive").insert(
      (items ?? []).map((item) => ({
        item_id: item.id,
        item_snapshot: { ...item, profiles: { first_name: profile.first_name, last_name: profile.last_name } },
      })),
    );
  }

  const storagePaths: string[] = [];
  for (const item of items ?? []) {
    const itemImages = (item as { images?: { image_url: string }[] }).images ?? [];
    for (const img of itemImages) {
      const path = extractStoragePath(img.image_url);
      if (path) storagePaths.push(path);
    }
  }
  const avatarPath = extractStoragePath(profile.avatar_url);
  if (avatarPath) storagePaths.push(avatarPath);
  if (storagePaths.length > 0) {
    await supabaseAdmin.storage.from("items").remove(storagePaths);
  }

  await supabaseAdmin.from("push_tokens").delete().eq("user_id", userId);

  const { error: deleteError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
  if (deleteError) throw deleteError;

  return { ok: true };
}
