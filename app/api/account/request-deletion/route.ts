import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Data deletion request — a Google Play Data Safety requirement (since
 * Dec 2023): the user must be able to request this via the web, without
 * signing in / installing the app (for example, if they've lost their
 * password). This route always sends the request to the admin
 * (/admin/deletion-requests), not an automatic processing tool — to
 * prevent abuse (deleting someone else's account using their email), the
 * admin verifies identity before processing.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, note } = await req.json();
    if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("account_deletion_requests").insert({
      email: email.trim().toLowerCase(),
      note: typeof note === "string" ? note.trim().slice(0, 500) || null : null,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/account/request-deletion:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
