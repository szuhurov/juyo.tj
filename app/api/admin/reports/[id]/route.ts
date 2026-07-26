import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { id } = await params;
    const { status } = await req.json();
    if (!["reviewed", "dismissed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { data: report, error: fetchError } = await supabaseAdmin
      .from("item_reports")
      .select("item_id")
      .eq("id", id)
      .single();
    if (fetchError) throw fetchError;

    const { error } = await supabaseAdmin.from("item_reports").update({ status }).eq("id", id);
    if (error) throw error;

    // "Баррасӣ шуд" = admin шикоятро тасдиқ кард — ашёи вайронкунанда бояд
    // воқеан нест шавад (Google Play UGC policy: report → амали воқеӣ,
    // на танҳо қайд кардани "дида шуд"). Soft-delete, мисли ItemService.deleteItem.
    if (status === "reviewed" && report?.item_id) {
      await supabaseAdmin
        .from("items")
        .update({ status: "deleted", deleted_at: new Date().toISOString() })
        .eq("id", report.item_id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/reports/[id]:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
