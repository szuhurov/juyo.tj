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

// Tajikistan runs a single zone, UTC+5, no DST — so this doesn't need a
// timezone library, just a fixed offset. category_post is an algorithmic
// "you might be interested" notice, not anything time-sensitive, so it's
// the one kind allowed to wait until morning rather than waking someone up.
const QUIET_HOURS_START = 22; // 22:00 local
const QUIET_HOURS_END = 8; // 08:00 local
function isQuietHoursNow(): boolean {
  const localHour = (new Date().getUTCHours() + 5) % 24;
  return localHour >= QUIET_HOURS_START || localHour < QUIET_HOURS_END;
}

// A reasonable per-user cap on how many category_post pushes go out in a
// rolling 24h window — protects against push fatigue on days with many
// approvals in a category, without ever touching the in-app notification
// list itself (get_my_category_notifications has no such cap — the item
// still shows up there either way, only the PUSH is skipped).
const DAILY_PUSH_CAP = 5;

// Web push (VAPID/aes128gcm) relies on Node's crypto.createECDH, which is
// not implemented in Deno's node:crypto polyfill ("Not implemented:
// crypto.ECDH") — so the actual encryption and sending happens not here,
// but through Vercel's /api/push/send (a real Node runtime).
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

// When a new listing gets approved, sends a push to users who have a
// listing of the OPPOSITE TYPE in the same category (if the new listing is
// "lost" — to owners of "found" listings in the same category, and vice
// versa) — not to everyone who has a listing in that category regardless of
// type. Called from trigger_notify_category_post() (see
// supabase/migrations/20260715000000_notify_category_and_qr_scan.sql).
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
      .select("id, title, category, type, user_id")
      .eq("id", item_id)
      .single();

    if (!item) {
      return new Response(JSON.stringify({ error: "item not found" }), { status: 404 });
    }

    // The listing's first image — for the large (Pinterest-like) display in the push.
    const { data: itemImage } = await supabase
      .from("item_images")
      .select("image_url")
      .eq("item_id", item.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Same rule as the in-app list (category_post_relevant in the DB):
    // live opposite-type listings in this category whose city/date/title
    // make it plausibly theirs — not every owner in the category.
    const { data: peers, error: peersError } = await supabase.rpc("get_category_post_recipients", {
      p_item_id: item.id,
    });
    if (peersError) throw peersError;

    let recipientIds = [...new Set(((peers ?? []) as string[]).filter(Boolean))];
    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // Quiet hours — skip the push entirely (the in-app list is unaffected,
    // computed independently by get_my_category_notifications).
    if (isQuietHoursNow()) {
      return new Response(JSON.stringify({ sent: 0, skipped: "quiet_hours" }), { status: 200 });
    }

    // Daily cap — drop recipients who already got DAILY_PUSH_CAP or more
    // category_post pushes in the last 24h, before even looking up their
    // tokens.
    const { data: recentSends } = await supabase
      .from("push_notification_log")
      .select("user_id")
      .eq("kind", "category_post")
      .in("user_id", recipientIds)
      .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const sendCounts = new Map<string, number>();
    for (const row of recentSends ?? []) {
      sendCounts.set(row.user_id, (sendCounts.get(row.user_id) ?? 0) + 1);
    }
    recipientIds = recipientIds.filter((id) => (sendCounts.get(id) ?? 0) < DAILY_PUSH_CAP);
    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: "daily_cap" }), { status: 200 });
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("platform, token, user_id")
      .in("user_id", recipientIds);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    const title = "JUYO";
    const body = `Эълони нав дар категорияи шумо: "${item.title}"`;
    const data = { type: "category_post", item_id: item.id };
    const image = itemImage?.image_url;

    let sent = 0;
    const staleTokenIds: string[] = [];

    await Promise.all(
      tokens.map(async (row: { platform: string; token: string; user_id: string }) => {
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
            const result = await sendWebPush(row.token, { title, body, data, image });
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

    // Log one row per RECIPIENT (not per device/token) — the cap above is
    // per-user, not per-device, so a user with both a phone and a browser
    // subscribed still only counts once per notification event.
    const loggedUserIds = [...new Set(tokens.map((t) => t.user_id))];
    if (loggedUserIds.length > 0) {
      await supabase
        .from("push_notification_log")
        .insert(loggedUserIds.map((user_id) => ({ user_id, kind: "category_post" })));
    }

    return new Response(JSON.stringify({ sent }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("notify-category-post error:", err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || "unknown error" }), { status: 500 });
  }
});
