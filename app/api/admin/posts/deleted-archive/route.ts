import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const filterUserId = searchParams.get("user_id");

    let query = supabaseAdmin
      .from("deleted_items_archive")
      .select("id, item_id, item_snapshot, deleted_at")
      .order("deleted_at", { ascending: false })
      .limit(200);
    // item_snapshot — the full JSON of the items row at the moment of
    // deletion, which also includes user_id — used for filtering by user.
    if (filterUserId) query = query.eq("item_snapshot->>user_id", filterUserId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ entries: data ?? [] });
  } catch (err) {
    console.error("GET /api/admin/posts/deleted-archive:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
