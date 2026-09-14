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
 * Replaces a single item_image (for example after the admin manually
 * blurs it) — the new photo is uploaded here (with the service role), the
 * item_images table is updated, and the OLD photo is removed from
 * storage. Everything is done with the service role (not the admin's own
 * client), because storage deletion is only permitted for the file's
 * actual owner, not the admin.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const formData = await req.formData();
    const imageId = formData.get("image_id");
    const oldImageUrl = formData.get("old_image_url");
    const file = formData.get("image");

    if (typeof imageId !== "string" || typeof oldImageUrl !== "string" || !(file instanceof File)) {
      return NextResponse.json({ error: "image_id, old_image_url ва image лозиманд" }, { status: 400 });
    }

    const { data: existing, error: checkError } = await supabaseAdmin
      .from("item_images")
      .select("id")
      .eq("id", imageId)
      .eq("item_id", id)
      .maybeSingle();
    if (checkError) throw checkError;
    if (!existing) return NextResponse.json({ error: "Акс ёфт нашуд" }, { status: 404 });

    const ext = file.name.split(".").pop() || "jpg";
    const path = `admin-blur-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("items")
      .upload(path, file, { contentType: file.type || "image/jpeg" });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseAdmin.storage.from("items").getPublicUrl(path);
    const newImageUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabaseAdmin
      .from("item_images")
      .update({ image_url: newImageUrl })
      .eq("id", imageId);
    if (updateError) throw updateError;

    const oldPath = extractStoragePath(oldImageUrl);
    if (oldPath) {
      await supabaseAdmin.storage.from("items").remove([oldPath]);
    }

    return NextResponse.json({ ok: true, image_url: newImageUrl });
  } catch (err) {
    console.error("PATCH /api/admin/posts/[id]/images:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
