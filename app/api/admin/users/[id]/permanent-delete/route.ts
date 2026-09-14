import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage, getErrorStatus } from "@/lib/error-utils";

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
 * Permanently delete an account — only for profiles that are already in
 * the trash (status='deleted'). Before deleting, a full snapshot
 * (profile + posts + saved items + confirmation requests) is saved,
 * so that clicking "Permanently deleted" still shows the data
 * — not just the profile, but what the user had done before being deleted.
 * It deletes Clerk itself first, then runs the Supabase cleanup (snapshot +
 * cascade hard-delete) directly right here — rather than relying solely on
 * the user.deleted webhook, since that event must be manually enabled
 * in the Clerk Dashboard.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId: adminId } = await auth();
  if (!isAdminUser(adminId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const { data: profile, error } = await supabaseAdmin.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!profile) {
      return NextResponse.json({ error: "Корбар ёфт нашуд" }, { status: 404 });
    }
    if (profile.status !== "deleted") {
      return NextResponse.json(
        { error: "Аввал корбарро нест кунед (ба trash гузаронед), баъд пурра нест кунед" },
        { status: 400 },
      );
    }

    const client = await clerkClient();
    try {
      await client.users.deleteUser(id);
    } catch (clerkErr) {
      if (getErrorStatus(clerkErr) !== 404) throw clerkErr;
    }

    const [{ data: items }, { data: savedItems }] = await Promise.all([
      supabaseAdmin.from("items").select(ITEM_FIELDS).eq("user_id", id),
      supabaseAdmin
        .from("saved_items")
        .select(`item_id, created_at, items(${ITEM_FIELDS})`)
        .eq("user_id", id),
    ]);

    const snapshot = {
      profile,
      items: items ?? [],
      savedItems: savedItems ?? [],
    };

    await supabaseAdmin.from("deleted_accounts_archive").insert([
      {
        user_id: id,
        profile_snapshot: snapshot,
        items_count: (items ?? []).length,
      },
    ]);

    // Each of the user's posts is also separately recorded in deleted_items_archive,
    // so the Posts → "Deleted" page can see them too (not just posts that were
    // deleted directly) — see app/api/admin/posts/[id]/permanent-delete.
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

    await supabaseAdmin.from("push_tokens").delete().eq("user_id", id);

    const { error: deleteError } = await supabaseAdmin.from("profiles").delete().eq("id", id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/admin/users/[id]/permanent-delete:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
