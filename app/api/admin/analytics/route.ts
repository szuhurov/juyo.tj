import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Platform admin analytics — Phase 9D. Auth model: admin allowlist
 * (isAdminUser), same as every other app/api/admin/** route. The actual
 * RPC (admin_get_platform_analytics) is service_role-only — this route is
 * the ONLY door to it, matching the established convention that a
 * Postgres RPC can't independently verify Clerk-admin status.
 *
 * ?format=csv exports the same data this page shows — never a separate,
 * differently-scoped query (see analytics-csv.ts).
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const days = Number(req.nextUrl.searchParams.get("days") ?? "30") || 30;
    const format = req.nextUrl.searchParams.get("format");

    const { data, error } = await supabaseAdmin.rpc("admin_get_platform_analytics", { p_days: days });
    if (error) throw error;

    await supabaseAdmin.rpc("admin_record_analytics_audit_event", {
      p_admin_user_id: userId,
      p_event_type: format === "csv" ? "export_generated" : "admin_report_accessed",
      p_metadata: { days },
    }).then(undefined, () => {
      // Audit logging must never block the actual report — fail-open,
      // same posture as the embedding-retry fire-and-forget pattern
      // elsewhere in this codebase.
    });

    if (format === "csv") {
      const { flattenAnalyticsForCsv, toCsv } = await import("@/lib/analytics-csv");
      const rows = flattenAnalyticsForCsv(data);
      const csv = toCsv(rows);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="juyo-platform-analytics-${days}d.csv"`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/admin/analytics:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
