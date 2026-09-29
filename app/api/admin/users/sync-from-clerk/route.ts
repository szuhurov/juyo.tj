import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { syncProfileFromClerk } from "@/lib/services/profile-sync";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Admin-only backfill: fills EMPTY email/name/avatar/phone of existing
 * profiles from Clerk (never overwrites). Runs here, not locally, because only
 * the deployed server has the production Clerk key. Auth: admin allowlist
 * (+ middleware); 404 for everyone else.
 */
export async function POST() {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id, status")
      .or(
        "email.is.null,email.eq.,first_name.is.null,first_name.eq.,last_name.is.null,last_name.eq.,avatar_url.is.null,avatar_url.eq.,phone.is.null,phone.eq.",
      )
      .limit(500);
    if (error) throw error;

    let updated = 0;
    let failed = 0;
    const fieldCounts: Record<string, number> = {};
    for (const row of rows ?? []) {
      if (row.status === "deleted") continue;
      try {
        const { filled } = await syncProfileFromClerk(row.id);
        if (filled.length > 0) updated++;
        for (const f of filled) fieldCounts[f] = (fieldCounts[f] ?? 0) + 1;
      } catch {
        // e.g. the account no longer exists in Clerk — skip it
        failed++;
      }
    }
    return NextResponse.json({ ok: true, checked: rows?.length ?? 0, updated, failed, fieldCounts });
  } catch (err) {
    console.error("POST /api/admin/users/sync-from-clerk:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
