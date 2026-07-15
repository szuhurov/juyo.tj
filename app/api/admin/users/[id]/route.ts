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
      { data: attempts },
      { count: pushTokenCount },
      { data: savedItems },
      { data: safetyBoxItems },
      { data: receivedClaims },
      { data: dismissed },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabaseAdmin
        .from("items")
        .select("id, title, type, category, is_resolved, moderation_status, created_at, images:item_images(image_url)")
        .eq("user_id", id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("item_verification_attempts")
        .select("id, item_id, status, created_at, answers, claimant_phone, items(title)")
        .eq("claimant_token", id)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("push_tokens").select("id", { count: "exact", head: true }).eq("user_id", id),
      supabaseAdmin
        .from("saved_items")
        .select("item_id, created_at, items(id, title, category, type, is_resolved, moderation_status, created_at, images:item_images(image_url))")
        .eq("user_id", id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("safety_box")
        .select("id, item_name, description, category, type, reward, images, date, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("item_verification_attempts")
        .select("id, item_id, status, created_at, answers, claimant_phone, claimant_token, items!inner(title, user_id)")
        .eq("items.user_id", id)
        .order("created_at", { ascending: false }),
      // Огоҳиномаҳое, ки худи корбар (ҳамчун соҳиби эълон ё довталаб) аз
      // рӯйхати худ "нест" кардааст — sabtи асосии item_verification_attempts
      // ҳаргиз пок намешавад, танҳо аз назари корбар пинҳон мешавад.
      supabaseAdmin
        .from("dismissed_notifications")
        .select("ref_id")
        .eq("user_id", id)
        .eq("kind", "verification"),
    ]);

    if (profileError) throw profileError;
    if (!profile) return NextResponse.json({ error: "Корбар ёфт нашуд" }, { status: 404 });

    const claimantTokens = Array.from(new Set((receivedClaims ?? []).map((a: any) => a.claimant_token).filter(Boolean)));
    let claimantProfiles: Record<string, { first_name: string | null; last_name: string | null; avatar_url: string | null }> = {};
    if (claimantTokens.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", claimantTokens);
      claimantProfiles = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
    }

    const dismissedIds = new Set((dismissed ?? []).map((d: any) => d.ref_id));

    const receivedClaimsEnriched = (receivedClaims ?? []).map((a: any) => ({
      ...a,
      claimantProfile: claimantProfiles[a.claimant_token] ?? null,
      is_deleted: dismissedIds.has(a.id),
    }));
    const attemptsEnriched = (attempts ?? []).map((a: any) => ({
      ...a,
      is_deleted: dismissedIds.has(a.id),
    }));

    return NextResponse.json({
      profile,
      items: items ?? [],
      verificationAttempts: attemptsEnriched,
      receivedClaims: receivedClaimsEnriched,
      savedItems: savedItems ?? [],
      safetyBoxItems: safetyBoxItems ?? [],
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
