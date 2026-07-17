import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
 * Иваз кардани як item_image (масалан баъд аз мозаика кардани дастии
 * admin) — акси нав ба ин ҷо (бо service role) боркунида мешавад, ҷадвали
 * item_images навсозӣ мешавад, ва акси КӮҲНА аз storage пок карда мешавад.
 * Ҳама бо service role иҷро мешавад (на клиенти худи admin), зеро
 * delete-и storage танҳо ба соҳиби аслии файл иҷозат медиҳад, на ба admin.
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
  } catch (err: any) {
    console.error("PATCH /api/admin/posts/[id]/images:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
