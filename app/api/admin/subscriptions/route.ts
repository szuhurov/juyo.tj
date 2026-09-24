import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

// Admin-only visibility into subscriptions — status/plan/dates/history.
// subscriptions has RLS enabled with zero client policies, so this
// service-role route is the only way to list across all users (a regular
// user only ever sees their own via get_my_subscriptions).
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = Math.max(0, Number(searchParams.get("page") ?? 0));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

    let query = supabaseAdmin
      .from("subscriptions")
      .select(
        "id, user_id, tier, duration_days, price_tjs, currency, status, starts_at, expires_at, created_at, cancelled_at, cancel_reason",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw error;

    // subscriptions.user_id has no FK to profiles (same as
    // dismissed_notifications/notification_reads) — a second lookup, not a
    // PostgREST embed.
    const userIds = [...new Set((data ?? []).map((s) => s.user_id))];
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, first_name, last_name").in("id", userIds)
      : { data: [] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));

    const subscriptions = (data ?? []).map((s) => ({ ...s, user_name: nameById.get(s.user_id) ?? null }));

    return NextResponse.json({ subscriptions, count: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
