import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * Proxy for `ai-brain` (AI check on publish/edit).
 *
 * BUG FOUND (user's question: "why should this even go to an edge function
 * at all?"): previously the client called the Supabase Edge Function
 * directly from the browser with a Clerk token. This path broke repeatedly —
 * first the old JWT template (signature verification failed), then the
 * gateway's verify_jwt (RS256/Uint8Array), then "Failed to send a
 * request to the Edge Function" — each time a new layer of
 * Clerk↔Supabase third-party auth trouble.
 *
 * ai-brain itself never relies on the caller's identity (it always works
 * with SUPABASE_SERVICE_ROLE_KEY — see supabase/functions/ai-brain),
 * so an identity check here (Clerk↔Supabase) was never actually needed.
 * Fix: the browser calls this same Next.js route (same-origin, no CORS, no
 * third-party JWT), and here (on the server) it forwards to ai-brain using
 * `supabaseAdmin` (the service-role key, which never has this class of
 * problem).
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
