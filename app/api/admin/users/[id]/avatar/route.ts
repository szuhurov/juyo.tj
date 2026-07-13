import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId: adminId } = await auth();
  if (!isAdminUser(adminId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл лозим аст" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Танҳо акс қабул мешавад" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const path = `avatars/${id}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("items")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseAdmin.storage.from("items").getPublicUrl(path);
    const avatar_url = publicUrlData.publicUrl;

    const { data: profile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({ profile });
  } catch (err: any) {
    console.error("POST /api/admin/users/[id]/avatar:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
