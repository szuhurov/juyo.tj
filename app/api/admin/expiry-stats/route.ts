import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Омори давраи ҳаёти эълонҳо барои admin.
 *
 * Ҳамаи шуморишҳо `head: true` мебошанд — танҳо адад бармегардад, на
 * сатрҳо. Дар ин route маълумоти шахсӣ (телефон, ном) умуман хонда
 * намешавад.
 */
export async function GET() {
  const { userId } = await auth();
  // 404, на 403 — то мавҷудияти endpoint тасдиқ нашавад (ниг. security.rules).
  if (!isAdminUser(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 86_400_000).toISOString();
    const nowIso = now.toISOString();

    const countOf = async (build: (q: ReturnType<typeof baseQuery>) => unknown) => {
      const q = baseQuery();
      const { count, error } = (await build(q)) as { count: number | null; error: unknown };
      if (error) throw error;
      return count ?? 0;
    };
    const baseQuery = () =>
      supabaseAdmin.from("items").select("id", { count: "exact", head: true });

    const [total, withoutExpiry, expiringIn30Days, awaitingConfirm] = await Promise.all([
      countOf((q) => q),
      countOf((q) => q.is("expires_at", null)),
      countOf((q) =>
        q.gte("expires_at", nowIso).lte("expires_at", in30Days).is("expiry_confirm_deadline", null),
      ),
      countOf((q) => q.not("expiry_confirm_deadline", "is", null).gt("expiry_confirm_deadline", nowIso)),
    ]);

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("post_lifetime_days")
      .eq("id", true)
      .maybeSingle();

    return NextResponse.json({
      total,
      /** Бе `expires_at` — набояд бошад; агар ҳаст, trigger кор намекунад. */
      withoutExpiry,
      /** Дар 30 рӯзи оянда мӯҳлаташон тамом мешавад. */
      expiringIn30Days,
      /** Огоҳинома рафтааст, дар 72 соати интизорӣ мебошанд. */
      awaitingConfirm,
      postLifetimeDays: settings?.post_lifetime_days ?? 180,
    });
  } catch (err) {
    console.error("GET /api/admin/expiry-stats:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
