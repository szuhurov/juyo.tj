import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const { data, error } = await supabaseAdmin
      .from("deleted_accounts_archive")
      .select("id, user_id, profile_snapshot, items_count, deleted_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Сабт ёфт нашуд" }, { status: 404 });

    return NextResponse.json({ entry: data });
  } catch (err: any) {
    console.error("GET /api/admin/users/deleted-archive/[id]:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
