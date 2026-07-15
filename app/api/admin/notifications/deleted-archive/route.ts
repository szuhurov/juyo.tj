import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("deleted_notifications_archive")
      .select(
        "id, user_id, kind, ref_id, item_id, item_title, related_name, related_avatar, status, deleted_at",
      )
      .order("deleted_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    // Номи корбареро, ки огоҳиномаро нест кардааст, илова мекунем (барои admin муфид аст).
    const userIds = [...new Set((data ?? []).map((e) => e.user_id))];
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, first_name, last_name").in("id", userIds)
      : { data: [] as any[] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const entries = (data ?? []).map((e) => ({
      ...e,
      deleter_name: profileMap.has(e.user_id)
        ? `${profileMap.get(e.user_id)?.first_name ?? ""} ${profileMap.get(e.user_id)?.last_name ?? ""}`.trim()
        : null,
    }));

    return NextResponse.json({ entries });
  } catch (err: any) {
    console.error("GET /api/admin/notifications/deleted-archive:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
