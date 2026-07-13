import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("deleted_items_archive")
      .select("id, item_id, item_snapshot, deleted_at")
      .order("deleted_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    return NextResponse.json({ entries: data ?? [] });
  } catch (err: any) {
    console.error("GET /api/admin/posts/deleted-archive:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
