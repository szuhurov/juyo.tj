import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

// Admins get VIP/VVIP for free: right after an admin creates a subscription
// request, the client calls this route and the admin's OWN pending request is
// activated at price 0 (no payment is asked, and the payment record shows 0).
// Auth model: Clerk session (Bearer token from the native app or cookie from
// the web) + admin allowlist, both in middleware (/api/admin(.*)) and here.
// Non-admins get the same 404 as any unknown route.
export async function POST() {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // supabaseAdmin bypasses RLS, so ownership is checked explicitly: only the
    // caller's own pending row is ever touched.
    const { data: sub, error: findError } = await supabaseAdmin
      .from("subscriptions")
      .select("id, user_id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;
    if (!sub || sub.user_id !== userId) {
      return NextResponse.json({ error: "No pending subscription" }, { status: 404 });
    }

    const { error: priceError } = await supabaseAdmin
      .from("subscriptions")
      .update({ price_tjs: 0 })
      .eq("id", sub.id)
      .eq("user_id", userId);
    if (priceError) throw priceError;

    const { error } = await supabaseAdmin.rpc("admin_activate_subscription", {
      p_subscription_id: sub.id,
      p_admin_id: userId,
    });
    if (error) {
      // e.g. "VVIP is currently taken" — the request stays pending.
      const status = /taken/i.test(error.message) ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
