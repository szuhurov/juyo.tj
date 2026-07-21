import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET() {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("deleted_accounts_archive")
      .select("id, user_id, profile_snapshot, items_count, deleted_at")
      .order("deleted_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    return NextResponse.json({ entries: data ?? [] });
  } catch (err) {
    console.error("GET /api/admin/users/deleted-archive:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
