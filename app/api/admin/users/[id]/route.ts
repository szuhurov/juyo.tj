import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_FIELDS = [
  "first_name",
  "last_name",
  "phone",
  "secondary_phone",
  "email",
  "is_qr_active",
  "status",
  "is_verified",
] as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const [
      { data: profile, error: profileError },
      { data: items },
      { count: pushTokenCount },
      { data: savedItems },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabaseAdmin
        .from("items")
        .select("id, title, type, category, is_resolved, moderation_status, created_at, images:item_images(image_url)")
        .eq("user_id", id)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("push_tokens").select("id", { count: "exact", head: true }).eq("user_id", id),
      supabaseAdmin
        .from("saved_items")
        .select("item_id, created_at, items(id, title, category, type, is_resolved, moderation_status, created_at, images:item_images(image_url))")
        .eq("user_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (profileError) throw profileError;
    if (!profile) return NextResponse.json({ error: "Корбар ёфт нашуд" }, { status: 404 });

    return NextResponse.json({
      profile,
      items: items ?? [],
      savedItems: savedItems ?? [],
      pushTokenCount: pushTokenCount ?? 0,
    });
  } catch (err: any) {
    console.error("GET /api/admin/users/[id]:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId: adminId } = await auth();
  if (!isAdminUser(adminId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Ягон майдони муҷоз нест" }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();
  if (updates.status && updates.status !== "deleted") {
    updates.deleted_at = null;
  }

  try {
    const { data, error } = await supabaseAdmin.from("profiles").update(updates).eq("id", id).select().single();
    if (error) throw error;

    return NextResponse.json({ profile: data });
  } catch (err: any) {
    console.error("PATCH /api/admin/users/[id]:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId: adminId } = await auth();
  if (!isAdminUser(adminId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /api/admin/users/[id]:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
