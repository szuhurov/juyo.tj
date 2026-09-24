import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

// Admin-only visibility into item_matches — score/reasons/both items and
// their owners' names (NOT phone numbers; matches the same
// public_profiles-shaped fields already exposed elsewhere, never the
// phone-number RPC). item_matches itself has RLS enabled with zero
// policies, so only this service-role route (or a client-side RPC scoped
// to "my own matches") can read it at all.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(0, Number(searchParams.get("page") ?? 0));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

    const { data, error, count } = await supabaseAdmin
      .from("item_matches")
      .select(
        "id, score, reasons, created_at, " +
          "lost:items!item_matches_lost_item_id_fkey(id, title, user_id, type, moderation_status, is_resolved, status), " +
          "found:items!item_matches_found_item_id_fkey(id, title, user_id, type, moderation_status, is_resolved, status)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    if (error) throw error;

    return NextResponse.json({ matches: data ?? [], count: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
