import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { startOfDay, startOfMonth } from "date-fns";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const NOT_DELETED = "status.is.null,status.neq.deleted";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status") ?? "active";
    const joined = searchParams.get("joined");
    const pushEnabled = searchParams.get("pushEnabled") === "1";
    const sort = searchParams.get("sort") === "last_login_at" ? "last_login_at" : "created_at";
    const order = searchParams.get("order") === "asc";
    const page = Math.max(0, Number(searchParams.get("page") ?? 0));
    const pageSize = Math.min(1000, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

    let query = supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, avatar_url, phone, email, status, created_at, last_login_at, deleted_at", {
        count: "exact",
      });

    if (status === "active") query = query.or(NOT_DELETED);
    else if (status === "deleted") query = query.eq("status", "deleted");

    if (joined === "today") query = query.gte("created_at", startOfDay(new Date()).toISOString());
    else if (joined === "month") query = query.gte("created_at", startOfMonth(new Date()).toISOString());

    if (search) {
      const s = search.slice(0, 100).replace(/[%_\\]/g, "\\$&");
      query = query.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
    }

    if (pushEnabled) {
      const { data: pushRows } = await supabaseAdmin.from("push_tokens").select("user_id");
      const pushUserIds = Array.from(new Set((pushRows ?? []).map((r) => r.user_id)));
      if (pushUserIds.length === 0) {
        return NextResponse.json({ users: [], total: 0, page, pageSize });
      }
      query = query.in("id", pushUserIds);
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;
    query = query.order(sort, { ascending: order }).range(from, to);

    const { data: profiles, count, error } = await query;
    if (error) throw error;

    const userIds = (profiles ?? []).map((p) => p.id);
    let itemCounts = new Map<string, { total: number; resolved: number }>();
    if (userIds.length > 0) {
      const { data: itemRows } = await supabaseAdmin
        .from("items")
        .select("user_id, is_resolved")
        .in("user_id", userIds)
        .or(NOT_DELETED);
      itemCounts = new Map();
      for (const row of itemRows ?? []) {
        const entry = itemCounts.get(row.user_id) ?? { total: 0, resolved: 0 };
        entry.total++;
        if (row.is_resolved) entry.resolved++;
        itemCounts.set(row.user_id, entry);
      }
    }

    const users = (profiles ?? []).map((p) => ({
      ...p,
      itemsCount: itemCounts.get(p.id)?.total ?? 0,
      resolvedCount: itemCounts.get(p.id)?.resolved ?? 0,
    }));

    return NextResponse.json({ users, total: count ?? 0, page, pageSize });
  } catch (err: any) {
    console.error("GET /api/admin/users:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
