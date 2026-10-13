import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  format,
  startOfDay,
  startOfMonth,
  startOfHour,
  subDays,
  subMonths,
} from "date-fns";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { CATEGORIES } from "@/lib/services/item-service";
import { getErrorMessage } from "@/lib/error-utils";

// PostgREST's .neq() doesn't work with NULL (NULL <> 'deleted' = NULL, not true),
// so for "all active users" we always use .or() with status.is.null.
const NOT_DELETED = "status.is.null,status.neq.deleted";

type Period = "today" | "week" | "month" | "year" | "all";

// period affects: totalUsers/totalLostItems/totalFoundItems/totalResolvedItems/
// signupsByDay/itemsByCategory (these are computed over that period). When period
// is not provided (as the existing Users/Posts pages do), "all" applies with no
// date filter at all — i.e. the result stays the same as it always was (backward-compatible).
// usersJoinedToday/usersJoinedThisMonth/pendingModerationCount/totalPushEnabledUsers
// always use a fixed window, regardless of period.
function periodConfig(period: Period, now: Date) {
  switch (period) {
    case "today":
      return { start: startOfDay(now), granularity: "hour" as const, buckets: 24 };
    case "week":
      return { start: startOfDay(subDays(now, 6)), granularity: "day" as const, buckets: 7 };
    case "year":
      return { start: startOfMonth(subMonths(now, 11)), granularity: "month" as const, buckets: 12 };
    case "all":
      return { start: null, granularity: "month" as const, buckets: 12 };
    case "month":
    default:
      return { start: startOfDay(subDays(now, 29)), granularity: "day" as const, buckets: 30 };
  }
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const period = (req.nextUrl.searchParams.get("period") as Period) || "all";
    const now = new Date();
    const { start: periodStart, granularity, buckets } = periodConfig(period, now);
    const periodStartIso = periodStart?.toISOString();
    const todayStart = startOfDay(now).toISOString();
    const monthStart = startOfMonth(now).toISOString();

    let usersQuery = supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).or(NOT_DELETED);
    if (periodStartIso) usersQuery = usersQuery.gte("created_at", periodStartIso);

    let lostQuery = supabaseAdmin.from("items").select("id", { count: "exact", head: true }).eq("type", "lost").or(NOT_DELETED);
    if (periodStartIso) lostQuery = lostQuery.gte("created_at", periodStartIso);

    let foundQuery = supabaseAdmin.from("items").select("id", { count: "exact", head: true }).eq("type", "found").or(NOT_DELETED);
    if (periodStartIso) foundQuery = foundQuery.gte("created_at", periodStartIso);

    let resolvedQuery = supabaseAdmin.from("items").select("id", { count: "exact", head: true }).eq("is_resolved", true).or(NOT_DELETED);
    if (periodStartIso) resolvedQuery = resolvedQuery.gte("updated_at", periodStartIso);

    let signupsQuery = supabaseAdmin.from("profiles").select("created_at").or(NOT_DELETED);
    signupsQuery = signupsQuery.gte("created_at", (periodStart ?? subMonths(now, 11)).toISOString());

    let categoryQuery = supabaseAdmin.from("items").select("category").or(NOT_DELETED);
    if (periodStartIso) categoryQuery = categoryQuery.gte("created_at", periodStartIso);

    const [
      { count: totalUsers },
      { count: usersJoinedToday },
      { count: usersJoinedThisMonth },
      { count: totalLostItems },
      { count: totalFoundItems },
      { count: totalResolvedItems },
      { count: pendingModerationCount },
      { data: signupRows },
      { data: categoryRows },
      { data: pushTokenRows },
    ] = await Promise.all([
      usersQuery,
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).or(NOT_DELETED).gte("created_at", todayStart),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).or(NOT_DELETED).gte("created_at", monthStart),
      lostQuery,
      foundQuery,
      resolvedQuery,
      supabaseAdmin.from("items").select("id", { count: "exact", head: true }).eq("moderation_status", "pending").or(NOT_DELETED),
      signupsQuery,
      categoryQuery,
      supabaseAdmin.from("push_tokens").select("user_id"),
    ]);

    // Bucket signups by hour/day/month depending on period granularity.
    const bucketKey = (d: Date) => {
      if (granularity === "hour") return format(startOfHour(d), "yyyy-MM-dd'T'HH':00:00'");
      if (granularity === "month") return format(startOfMonth(d), "yyyy-MM-01");
      return format(startOfDay(d), "yyyy-MM-dd");
    };
    const bucketDates: Date[] = [];
    for (let i = buckets - 1; i >= 0; i--) {
      if (granularity === "hour") bucketDates.push(new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - i));
      else if (granularity === "month") bucketDates.push(startOfMonth(subMonths(now, i)));
      else bucketDates.push(startOfDay(subDays(now, i)));
    }
    const dayBuckets: Record<string, number> = {};
    bucketDates.forEach((d) => (dayBuckets[bucketKey(d)] = 0));
    (signupRows ?? []).forEach((row: { created_at: string }) => {
      const key = bucketKey(new Date(row.created_at));
      if (key in dayBuckets) dayBuckets[key]++;
    });
    const signupsByDay = Object.entries(dayBuckets).map(([date, count]) => ({ date, count }));

    const categoryCounts: Record<string, number> = {};
    (categoryRows ?? []).forEach((row: { category: string }) => {
      categoryCounts[row.category] = (categoryCounts[row.category] ?? 0) + 1;
    });
    // All real categories are shown, even at 0% — not just the ones that have posts in this period.
    const itemsByCategory = CATEGORIES.map((c) => ({ category: c.name, count: categoryCounts[c.name] ?? 0 }));

    // QR: the database keeps counters only (no dates), so this is always all-time.
    // "Set up" means activated at least once — is_qr_active alone defaults to true.
    let qr: {
      users: number;
      active: number;
      scans: number;
      list: { id: string; name: string; phone: string | null; is_qr_active: boolean; qr_activation_count: number; qr_scan_count: number }[];
    } | null = null;
    {
      const { data: qrRows, error: qrError } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, phone, is_qr_active, qr_activation_count, qr_scan_count")
        .gt("qr_activation_count", 0)
        .or(NOT_DELETED)
        .order("qr_scan_count", { ascending: false })
        .order("qr_activation_count", { ascending: false });
      if (!qrError) {
        const rows = (qrRows ?? []) as {
          id: string; first_name: string | null; last_name: string | null; phone: string | null;
          is_qr_active: boolean | null; qr_activation_count: number; qr_scan_count: number;
        }[];
        qr = {
          users: rows.length,
          active: rows.filter((r) => r.is_qr_active).length,
          scans: rows.reduce((sum, r) => sum + (r.qr_scan_count ?? 0), 0),
          list: rows.slice(0, 100).map((r) => ({
            id: r.id,
            name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Беном",
            phone: r.phone,
            is_qr_active: !!r.is_qr_active,
            qr_activation_count: r.qr_activation_count ?? 0,
            qr_scan_count: r.qr_scan_count ?? 0,
          })),
        };
      }
    }

    const totalPushEnabledUsers = new Set((pushTokenRows ?? []).map((r: { user_id: string }) => r.user_id)).size;

    return NextResponse.json({
      period,
      totalUsers: totalUsers ?? 0,
      usersJoinedToday: usersJoinedToday ?? 0,
      usersJoinedThisMonth: usersJoinedThisMonth ?? 0,
      totalLostItems: totalLostItems ?? 0,
      totalFoundItems: totalFoundItems ?? 0,
      totalResolvedItems: totalResolvedItems ?? 0,
      pendingModerationCount: pendingModerationCount ?? 0,
      totalPushEnabledUsers,
      qr,
      signupsByDay,
      signupsGranularity: granularity,
      itemsByCategory,
    });
  } catch (err) {
    console.error("GET /api/admin/stats:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
