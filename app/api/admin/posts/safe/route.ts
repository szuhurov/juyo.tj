import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * The "safe" list: pending listings whose every photo the weapons model scored
 * SAFE (admin_safe_candidates in 20261007010000_image_moderation.sql).
 * `admin_checked` = the scores come from vectors this admin's browser computed;
 * only those can be approved in bulk.
 * Auth model: admin allowlist (middleware + isAdminUser), 404 otherwise.
 */
export async function GET() {
  const { userId } = await auth();
  if (!isAdminUser(userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: candidates, error } = await supabaseAdmin.rpc("admin_safe_candidates", { p_limit: 50 });
  if (error) {
    console.error("GET /api/admin/posts/safe:", error.code);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  const list = (candidates ?? []) as { item_id: string; updated_at: string; admin_checked: boolean }[];
  if (list.length === 0) return NextResponse.json({ posts: [] });

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("items")
    .select("id, title, description, category, type, created_at, images:item_images(id, image_url)")
    .in("id", list.map((c) => c.item_id));
  if (itemsError) {
    console.error("GET /api/admin/posts/safe items:", itemsError.code);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  const byId = new Map((items ?? []).map((i) => [i.id, i]));
  const posts = list
    .filter((c) => byId.has(c.item_id))
    .map((c) => ({ ...byId.get(c.item_id)!, updated_at: c.updated_at, admin_checked: c.admin_checked }));
  return NextResponse.json({ posts });
}
