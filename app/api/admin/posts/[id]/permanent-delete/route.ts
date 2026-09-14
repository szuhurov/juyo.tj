import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

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

/**
 * Permanently deletes a post — only for posts that are already in the
 * trash (status='deleted'). A snapshot is saved to deleted_items_archive
 * (the same table also used by the "permanently delete user" cascade —
 * see app/api/admin/users/[id]/permanent-delete), so the Posts page can
 * show both cases (directly deleted and cascaded from a deleted user)
 * together.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId: adminId } = await auth();
  if (!isAdminUser(adminId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const { data: item, error } = await supabaseAdmin
      .from("items")
      .select("*, images:item_images(image_url), profiles!items_user_id_fkey(first_name, last_name)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!item) {
      return NextResponse.json({ error: "Эълон ёфт нашуд" }, { status: 404 });
    }
    if (item.status !== "deleted") {
      return NextResponse.json(
        { error: "Аввал эълонро нест кунед (ба trash гузаронед), баъд пурра нест кунед" },
        { status: 400 },
      );
    }

    await supabaseAdmin.from("deleted_items_archive").insert([{ item_id: id, item_snapshot: item }]);

    const itemImages = (item as { images?: { image_url: string }[] }).images ?? [];
    const storagePaths = itemImages
      .map((img) => extractStoragePath(img.image_url))
      .filter((p): p is string => !!p);
    if (storagePaths.length > 0) {
      await supabaseAdmin.storage.from("items").remove(storagePaths);
    }

    const { error: deleteError } = await supabaseAdmin.from("items").delete().eq("id", id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/admin/posts/[id]/permanent-delete:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
