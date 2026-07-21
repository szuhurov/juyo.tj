import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

const NOT_DELETED = "status.is.null,status.neq.deleted";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const moderationStatus = searchParams.get("moderation_status");
    const resolved = searchParams.get("resolved");
    const status = searchParams.get("status") ?? "active";
    const filterUserId = searchParams.get("user_id");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = Math.max(0, Number(searchParams.get("page") ?? 0));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

    let query = supabaseAdmin
      .from("items")
      .select(
        "id, title, category, type, is_resolved, moderation_status, status, created_at, user_id, profiles!items_user_id_fkey(first_name, last_name), images:item_images(image_url)",
        { count: "exact" },
      );

    if (status === "active") query = query.or(NOT_DELETED);
    else if (status === "deleted") query = query.eq("status", "deleted");

    if (type) query = query.eq("type", type);
    if (category) query = query.eq("category", category);
    if (moderationStatus) query = query.eq("moderation_status", moderationStatus);
    if (resolved === "true") query = query.eq("is_resolved", true);
    else if (resolved === "false") query = query.eq("is_resolved", false);
    if (filterUserId) query = query.eq("user_id", filterUserId);
    if (dateFrom) query = query.gte("created_at", new Date(`${dateFrom}T00:00:00.000Z`).toISOString());
    if (dateTo) query = query.lte("created_at", new Date(`${dateTo}T23:59:59.999Z`).toISOString());

    if (search) {
      const s = search.slice(0, 100).replace(/[%_\\]/g, "\\$&");
      query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;
    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ posts: data ?? [], total: count ?? 0, page, pageSize });
  } catch (err) {
    console.error("GET /api/admin/posts:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
