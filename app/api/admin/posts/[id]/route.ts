import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ItemService } from "@/lib/services/item-service";

const ALLOWED_FIELDS = [
  "title",
  "description",
  "category",
  "type",
  "is_resolved",
  "moderation_status",
  "reward",
  "phone_number",
  "status",
] as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const { data: item, error } = await supabaseAdmin
      .from("items")
      .select("*, images:item_images(id, image_url), profiles!items_user_id_fkey(id, first_name, last_name, avatar_url, phone)")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!item) return NextResponse.json({ error: "Эълон ёфт нашуд" }, { status: 404 });

    const { data: verificationAttempts } = await supabaseAdmin
      .from("item_verification_attempts")
      .select("id, claimant_token, answers, status, created_at, reviewed_at")
      .eq("item_id", id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ item, verificationAttempts: verificationAttempts ?? [] });
  } catch (err: any) {
    console.error("GET /api/admin/posts/[id]:", err.message);
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
    const { data, error } = await supabaseAdmin.from("items").update(updates).eq("id", id).select().single();
    if (error) throw error;

    return NextResponse.json({ item: data });
  } catch (err: any) {
    console.error("PATCH /api/admin/posts/[id]:", err.message);
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
    await ItemService.deleteItem(supabaseAdmin, id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /api/admin/posts/[id]:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
