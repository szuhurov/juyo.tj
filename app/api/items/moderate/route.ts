import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Прокси барои `ai-brain` (санҷиши AI ҳангоми нашр/таҳрир).
 *
 * ХАТОГИИ ЁФТШУДА (талаби корбар: "чаро аслан бояд ба edge function
 * равон карда шавад?"): пештар клиент бевосита аз браузер ба Supabase
 * Edge Function бо токени Clerk занг мезад. Ин масир борҳо вайрон шуд —
 * аввал JWT template-и кӯҳна (signature verification failed), баъд
 * verify_jwt-и gateway (RS256/Uint8Array), баъд "Failed to send a
 * request to the Edge Function" — ҳар бор як қабати нави мушкилоти
 * Clerk↔Supabase third-party auth.
 *
 * ai-brain худаш ҳеҷ гоҳ ба ҳувияти занговар такя намекунад (ҳамеша бо
 * SUPABASE_SERVICE_ROLE_KEY кор мекунад — ниг. supabase/functions/ai-brain),
 * пас санҷиши ҳувият дар ин ҷо (Clerk↔Supabase) аслан лозим НАБУД. Ҳал:
 * браузер ба ҳамин route-и худи Next.js (same-origin, бе CORS, бе
 * third-party JWT) занг мезанад, ва ҳамин ҷо (сервер) бо
 * `supabaseAdmin` (калиди service-role, ки ин синфи мушкилотро ҳаргиз
 * надорад) ба ai-brain мерасонад.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const { data, error } = await supabaseAdmin.functions.invoke("ai-brain", {
      body: formData,
    });

    if (error) {
      console.error("POST /api/items/moderate (ai-brain):", error.message);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("POST /api/items/moderate:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
