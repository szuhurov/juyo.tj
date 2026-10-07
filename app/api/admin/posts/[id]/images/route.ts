import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";
import { isNoPhotoCategory } from "@/lib/photo-policy";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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

function isJpegOrPng(file: File) {
  return file.type === "image/jpeg" || file.type === "image/png";
}

/**
 * Replaces a single item_image after the admin hides personal details on
 * it. The new photo and its small copy are uploaded with the service role,
 * item_images is updated, and the OLD photo and OLD small copy are removed
 * from storage — otherwise the unredacted small copy would stay public.
 * The old paths come from the database, never from the request, so this
 * route can only delete files that belong to this image.
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
    const file = formData.get("image");
    const thumbnail = formData.get("thumbnail");

    if (typeof imageId !== "string" || !(file instanceof File) || !(thumbnail instanceof File)) {
      return NextResponse.json({ error: "image_id, image ва thumbnail лозиманд" }, { status: 400 });
    }
    if (!isJpegOrPng(file) || !isJpegOrPng(thumbnail) || file.size > MAX_IMAGE_BYTES || thumbnail.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Акс бояд JPEG ё PNG ва то 10 MB бошад" }, { status: 400 });
    }

    // Documents/Cards listings never hold a photo (lib/photo-policy.ts); do not
    // put one in the public bucket even for a moment.
    const { data: itemRow, error: itemError } = await supabaseAdmin
      .from("items")
      .select("category")
      .eq("id", id)
      .maybeSingle();
    if (itemError) throw itemError;
    if (isNoPhotoCategory(itemRow?.category)) {
      return NextResponse.json({ error: "Эълонҳои ҳуҷҷат ва корт акс надоранд" }, { status: 400 });
    }

    const { data: existing, error: checkError } = await supabaseAdmin
      .from("item_images")
      .select("id, image_url, thumbnail_url")
      .eq("id", imageId)
      .eq("item_id", id)
      .maybeSingle();
    if (checkError) throw checkError;
    if (!existing) return NextResponse.json({ error: "Акс ёфт нашуд" }, { status: 404 });

    const ext = file.type === "image/png" ? "png" : "jpg";
    const base = `admin-blur-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `${base}.${ext}`;
    const thumbPath = `${base}-thumb.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("items")
      .upload(path, file, { contentType: file.type });
    if (uploadError) throw uploadError;
    const { error: thumbUploadError } = await supabaseAdmin.storage
      .from("items")
      .upload(thumbPath, thumbnail, { contentType: thumbnail.type });
    if (thumbUploadError) {
      await supabaseAdmin.storage.from("items").remove([path]);
      throw thumbUploadError;
    }

    const newImageUrl = supabaseAdmin.storage.from("items").getPublicUrl(path).data.publicUrl;
    const newThumbUrl = supabaseAdmin.storage.from("items").getPublicUrl(thumbPath).data.publicUrl;

    const { error: updateError } = await supabaseAdmin
      .from("item_images")
      .update({ image_url: newImageUrl, thumbnail_url: newThumbUrl })
      .eq("id", imageId);
    if (updateError) {
      await supabaseAdmin.storage.from("items").remove([path, thumbPath]);
      throw updateError;
    }

    const oldPaths = [existing.image_url, existing.thumbnail_url]
      .map(extractStoragePath)
      .filter((p): p is string => !!p);
    if (oldPaths.length > 0) {
      const { error: removeError } = await supabaseAdmin.storage.from("items").remove(oldPaths);
      if (removeError) console.error("PATCH /api/admin/posts/[id]/images: old file removal failed:", removeError.message);
    }

    return NextResponse.json({ ok: true, image_url: newImageUrl, thumbnail_url: newThumbUrl });
  } catch (err) {
    console.error("PATCH /api/admin/posts/[id]/images:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
