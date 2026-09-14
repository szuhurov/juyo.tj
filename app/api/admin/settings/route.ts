import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET() {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { data, error } = await supabaseAdmin.from("app_settings").select("*").eq("id", true).single();
    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (err) {
    console.error("GET /api/admin/settings:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.ai_moderation_enabled === "boolean") {
    updates.ai_moderation_enabled = body.ai_moderation_enabled;
  }
  // Post lifetime in days. A limit is mandatory: 0 would mean "delete
  // everything tomorrow", and a nonsensical number would break the cron
  // schedule. 7 days to 10 years is a reasonable range.
  if (body.post_lifetime_days !== undefined) {
    const days = Number(body.post_lifetime_days);
    if (!Number.isInteger(days) || days < 7 || days > 3650) {
      return NextResponse.json(
        { error: "post_lifetime_days бояд адади бутуни байни 7 ва 3650 бошад" },
        { status: 400 },
      );
    }
    updates.post_lifetime_days = days;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Ягон майдони муҷоз нест" }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabaseAdmin.from("app_settings").update(updates).eq("id", true).select().single();
    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (err) {
    console.error("PATCH /api/admin/settings:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
