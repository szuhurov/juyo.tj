import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Act on a user report:
 *  - "remove_item": the listing breaks the rules → rejected (hidden from
 *    everyone, the owner sees why), and every open report on it is resolved;
 *  - "keep_item": no violation → the listing is approved again (it may have
 *    been hidden by 3 reports) and its open reports are dismissed;
 *  - "dismiss": close just this report without touching the listing.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId: adminId } = await auth();
  if (!isAdminUser(adminId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { id } = await params;
    const { action, note } = (await req.json()) as { action?: string; note?: string };
    if (!["remove_item", "keep_item", "dismiss"].includes(action ?? "")) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    const adminNote = typeof note === "string" ? note.slice(0, 500) : null;

    const { data: report, error: fetchError } = await supabaseAdmin
      .from("content_reports")
      .select("id, item_id")
      .eq("id", id)
      .single();
    if (fetchError) throw fetchError;

    const now = new Date().toISOString();

    if (action !== "dismiss" && report.item_id) {
      const { error: itemError } = await supabaseAdmin
        .from("items")
        .update(
          action === "remove_item"
            ? { moderation_status: "rejected", moderation_result: "mod_reported_content" }
            : { moderation_status: "approved", moderation_result: "Approved by admin after report review" },
        )
        .eq("id", report.item_id);
      if (itemError) throw itemError;

      const { error: bulkError } = await supabaseAdmin
        .from("content_reports")
        .update({ status: action === "remove_item" ? "resolved" : "dismissed", admin_note: adminNote, resolved_at: now })
        .eq("item_id", report.item_id)
        .eq("status", "open");
      if (bulkError) throw bulkError;
    } else {
      const { error } = await supabaseAdmin
        .from("content_reports")
        .update({ status: "dismissed", admin_note: adminNote, resolved_at: now })
        .eq("id", id);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/reports/[id]:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
