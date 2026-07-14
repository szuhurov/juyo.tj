import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://juyo.tj";
const PUSH_INTERNAL_SECRET = Deno.env.get("PUSH_INTERNAL_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Web push (VAPID/aes128gcm) такя ба crypto.createECDH-и Node дорад, ки
// дар Deno's node:crypto polyfill татбиқ нашудааст ("Not implemented:
// crypto.ECDH") — бинобар ин рамзгузорӣ ва фиристодани воқеӣ на аз ин ҷо,
// балки аз /api/push/send-и Vercel (runtime-и воқеии Node) иҷро мешавад.
async function sendWebPush(token: string, payload: object): Promise<{ ok: boolean; statusCode?: number }> {
  const subscription = JSON.parse(token);
  const res = await fetch(`${SITE_URL}/api/push/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": PUSH_INTERNAL_SECRET ?? "" },
    body: JSON.stringify({ subscription, payload }),
  });
  const result = await res.json().catch(() => ({ ok: false }));
  if (!result.ok) console.error("web push relay failed:", result.message);
  return result;
}

// Ҳар бор, ки касе QR-и фаъоли корбареро scan мекунад (саҳифаи ҷамъиятии
// /qr/[id] кушода мешавад), ба худи соҳиби QR push мефиристад. Аз
// increment_qr_scan_count() (ниг.
// supabase/migrations/20260715000000_notify_category_and_qr_scan.sql)
// даъват мешавад.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const { user_id, scan_count } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), { status: 400 });
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("platform, token")
      .eq("user_id", user_id);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    const title = "JUYO.TJ";
    const body =
      typeof scan_count === "number"
        ? `Касе QR-и шуморо scan кард! (Ҳамагӣ ${scan_count} бор)`
        : "Касе QR-и шуморо scan кард!";
    const data = { type: "qr_scan" };

    let sent = 0;
    const staleTokenIds: string[] = [];

    await Promise.all(
      tokens.map(async (row: { platform: string; token: string }) => {
        try {
          if (row.platform === "expo") {
            const res = await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ to: row.token, title, body, data, sound: "default" }),
            });
            const result = await res.json().catch(() => null);
            const status = result?.data?.status ?? result?.data?.[0]?.status;
            if (status === "error") {
              staleTokenIds.push(row.token);
            } else {
              sent++;
            }
          } else if (row.platform === "web") {
            const result = await sendWebPush(row.token, { title, body, data });
            if (result.ok) {
              sent++;
            } else if (result.statusCode === 404 || result.statusCode === 410) {
              staleTokenIds.push(row.token);
            }
          }
        } catch (err: any) {
          console.error("push send failed:", row.platform, err?.message || err);
        }
      }),
    );

    if (staleTokenIds.length > 0) {
      await supabase.from("push_tokens").delete().in("token", staleTokenIds);
    }

    return new Response(JSON.stringify({ sent }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("notify-qr-scan error:", err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || "unknown error" }), { status: 500 });
  }
});
