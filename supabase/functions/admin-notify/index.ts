import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@juyo.tj";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const { user_ids, title, body } = await req.json();
    if (!Array.isArray(user_ids) || user_ids.length === 0 || !title || !body) {
      return new Response(JSON.stringify({ error: "user_ids, title and body are required" }), { status: 400 });
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("user_id, platform, token")
      .in("user_id", user_ids);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = { type: "admin_broadcast" };
    let sent = 0;
    let failed = 0;
    const staleTokenIds: string[] = [];

    await Promise.all(
      tokens.map(async (row: { platform: string; token: string }) => {
        try {
          if (row.platform === "expo") {
            const res = await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({ to: row.token, title, body, data, sound: "default" }),
            });
            const result = await res.json().catch(() => null);
            const status = result?.data?.status ?? result?.data?.[0]?.status;
            if (status === "error") {
              staleTokenIds.push(row.token);
              failed++;
            } else {
              sent++;
            }
          } else if (row.platform === "web" && VAPID_PRIVATE_KEY) {
            const subscription = JSON.parse(row.token);
            await webpush.sendNotification(subscription, JSON.stringify({ title, body, data }));
            sent++;
          } else {
            failed++;
          }
        } catch (err: any) {
          const statusCode = err?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            staleTokenIds.push(row.token);
          }
          failed++;
          console.error("admin-notify send failed:", row.platform, err?.message || err);
        }
      }),
    );

    if (staleTokenIds.length > 0) {
      await supabase.from("push_tokens").delete().in("token", staleTokenIds);
    }

    return new Response(JSON.stringify({ sent, failed }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("admin-notify error:", err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || "unknown error" }), { status: 500 });
  }
});
