import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hardDeleteItem } from "@/lib/services/item-deletion";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Ҷавоби соҳиб ба огоҳии «мӯҳлати эълон тамом шуд».
 *
 *   keep   → мӯҳлат аз нав (аз `app_settings.post_lifetime_days`), 72 соат бекор
 *   delete → нест кардани фаврӣ, бе интизори 72 соат
 *
 * Агар корбар ҳеҷ чиз назанад, cron-и рӯзона баъд аз 72 соат худаш нест
 * мекунад (ниг. supabase/functions/cleanup-expired-posts).
 *
 * Native низ ҳамин route-ро бо Bearer-и Clerk занг мезанад.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let action: unknown;
  try {
    ({ action } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (action !== "keep" && action !== "delete") {
    return NextResponse.json({ error: "action must be 'keep' or 'delete'" }, { status: 400 });
  }

  try {
    if (action === "delete") {
      // hardDeleteItem худаш соҳибиро месанҷад ва аксҳоро аз Storage мебарорад.
      const result = await hardDeleteItem(id, userId);
      if (!result.ok) {
        return NextResponse.json({ error: result.reason }, { status: result.status });
      }
      return NextResponse.json({ ok: true, action: "delete" });
    }

    // СОҲИБӢ аз рӯи база санҷида мешавад, на аз бадани дархост —
    // `supabaseAdmin` RLS-ро убур мекунад, пас ин санҷиш ягона монеа аст.
    const { data: item, error: fetchError } = await supabaseAdmin
      .from("items")
      .select("id, user_id, expiry_notified_at")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (item.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("post_lifetime_days")
      .eq("id", true)
      .maybeSingle();

    const days = settings?.post_lifetime_days ?? 180;
    const nextExpiry = new Date(Date.now() + days * 86_400_000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("items")
      .update({ expires_at: nextExpiry, expiry_notified_at: null })
      .eq("id", id);

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, action: "keep", expiresAt: nextExpiry });
  } catch (err) {
    console.error("POST /api/items/[id]/expiry:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
