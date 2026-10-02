import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";
import { deleteUserAccount } from "@/lib/services/account-deletion";

/**
 * Permanently delete an account — only for profiles that are already in
 * the trash (status='deleted'). Runs the same full deletion as a user
 * deleting their own account (Clerk + storage + push tokens + profile
 * cascade); no archived copy is kept.
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

    // Same full deletion as a user deleting their own account — no archived copy.
    await deleteUserAccount(id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/admin/users/[id]/permanent-delete:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
