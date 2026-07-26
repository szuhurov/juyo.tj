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
    const status = searchParams.get("status") ?? "pending";

    let query = supabaseAdmin
      .from("item_reports")
      .select("id, item_id, reporter_id, reason, details, status, created_at, items(title, moderation_status)")
      .order("created_at", { ascending: false });

    if (status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    // reporter_id ба profiles FK надорад (гости ҳам метавонанд, дар оянда) —
    // профилҳоро алоҳида lookup мекунем, на тавассути PostgREST embed.
    const reporterIds = [...new Set((data ?? []).map((r) => r.reporter_id))];
    const { data: reporters } = reporterIds.length
      ? await supabaseAdmin.from("profiles").select("id, first_name, last_name").in("id", reporterIds)
      : { data: [] };
    const reporterMap = new Map((reporters ?? []).map((p) => [p.id, p]));

    const reports = (data ?? []).map((r) => ({
      ...r,
      reporter: reporterMap.get(r.reporter_id) ?? null,
    }));

    return NextResponse.json({ reports });
  } catch (err) {
    console.error("GET /api/admin/reports:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
