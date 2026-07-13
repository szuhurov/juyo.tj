import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const NOT_DELETED = "status.is.null,status.neq.deleted";

export async function POST(req: NextRequest) {
  const { userId: adminId } = await auth();
  if (!isAdminUser(adminId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { title, body, target } = await req.json();
    if (typeof title !== "string" || !title.trim() || typeof body !== "string" || !body.trim() || !target) {
      return NextResponse.json({ error: "title, body ва target лозиманд" }, { status: 400 });
    }

    let userIds: string[] = [];
    if (target.mode === "all") {
      const { data } = await supabaseAdmin.from("profiles").select("id").or(NOT_DELETED);
      userIds = (data ?? []).map((p) => p.id);
    } else if (target.mode === "ids" || target.mode === "single") {
      userIds = Array.isArray(target.userIds) ? target.userIds : [];
    }

    if (userIds.length === 0) {
      return NextResponse.json({ error: "Ягон қабулкунанда ёфт нашуд" }, { status: 400 });
    }

    const { data: invokeData, error: invokeError } = await supabaseAdmin.functions.invoke("admin-notify", {
      body: { user_ids: userIds, title: title.trim(), body: body.trim() },
    });
    if (invokeError) throw invokeError;

    return NextResponse.json({
      recipientCount: userIds.length,
      sent: invokeData?.sent ?? 0,
      failed: invokeData?.failed ?? 0,
    });
  } catch (err: any) {
    console.error("POST /api/admin/notify:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
