import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

// The manual stand-in for a real payment webhook (see the migration's
// header comment — no payment provider is integrated this phase). Only
// reachable by an allowlisted admin; admin_activate_subscription itself is
// additionally locked to service_role at the database level, so even a
// leaked anon/authenticated key couldn't call it directly.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { id } = await params;
    const { error } = await supabaseAdmin.rpc("admin_activate_subscription", {
      p_subscription_id: id,
      p_admin_id: userId,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
