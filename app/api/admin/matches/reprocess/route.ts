import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

// Backfill for items approved BEFORE the Phase 5 AI-matching trigger
// existed — they never fired run_ai_matching_for_item, so without this
// they'd never get matched at all. admin_backfill_ai_matches() is locked
// to service_role only (see supabase/migrations/20260924000000_ai_matching.sql),
// so this route (Clerk admin allowlist + supabaseAdmin) is the only way to
// call it. Can take a while on a large catalog — same maxDuration reasoning
// as reprocess-embeddings.
export const maxDuration = 300;

export async function POST() {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("admin_backfill_ai_matches");
    if (error) throw error;
    return NextResponse.json({ scanned: data });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
