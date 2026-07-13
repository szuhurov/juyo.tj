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
    const { item_id } = await req.json();
    if (!item_id) {
      return new Response(JSON.stringify({ error: "item_id required" }), { status: 400 });
    }

    const { data: item } = await supabase
      .from("items")
      .select("title, user_id")
      .eq("id", item_id)
      .single();

    if (!item) {
      return new Response(JSON.stringify({ error: "item not found" }), { status: 404 });
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("platform, token")
      .eq("user_id", item.user_id);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    const title = "JUYO.TJ";
    const body = `Касе ба саволҳои "${item.title}" ҷавоб дод!`;
    const data = { type: "verification_attempt", item_id };

    let sent = 0;
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
              body: JSON.stringify({
                to: row.token,
                title,
                body,
                data,
                sound: "default",
              }),
            });
            const result = await res.json().catch(() => null);
            const status = result?.data?.status ?? result?.data?.[0]?.status;
            if (status === "error") {
              staleTokenIds.push(row.token);
            } else {
              sent++;
            }
          } else if (row.platform === "web" && VAPID_PRIVATE_KEY) {
            const subscription = JSON.parse(row.token);
            await webpush.sendNotification(
              subscription,
              JSON.stringify({ title, body, data }),
            );
            sent++;
          }
        } catch (err: any) {
          const statusCode = err?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            staleTokenIds.push(row.token);
          }
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
    console.error("notify-verification error:", err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || "unknown error" }), {
      status: 500,
    });
  }
});
