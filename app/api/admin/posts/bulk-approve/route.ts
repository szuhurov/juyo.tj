import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Approves, in one go, listings the admin looked at in the "safe" list.
 * The database re-checks every one (admin_bulk_approve): still pending,
 * unchanged since the list was loaded, not Documents/Cards, every photo SAFE
 * from the admin's own vector. Anything else is left for normal review.
 * Auth model: admin allowlist (middleware + isAdminUser), 404 otherwise.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { items?: { id?: unknown; updated_at?: unknown }[] } | null;
  const items = body?.items;
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 50 ||
    !items.every((i) => typeof i.id === "string" && UUID.test(i.id) && typeof i.updated_at === "string" && !Number.isNaN(Date.parse(i.updated_at)))
  ) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("admin_bulk_approve", {
    p_items: items.map((i) => ({ id: i.id, updated_at: i.updated_at })),
    p_admin: userId,
  });
  if (error) {
    console.error("POST /api/admin/posts/bulk-approve:", error.code);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  const approved = ((data ?? []) as (string | { admin_bulk_approve: string })[]).map((r) => (typeof r === "string" ? r : r.admin_bulk_approve));
  return NextResponse.json({ approved });
}
