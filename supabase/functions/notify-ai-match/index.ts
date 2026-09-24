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

// Same fixed UTC+5 quiet-hours window as notify-category-post
// (Web/supabase/functions/notify-category-post/index.ts) — a possible
// match isn't time-critical enough to justify waking someone up, so it
// gets the same treatment, not an exemption.
const QUIET_HOURS_START = 22;
const QUIET_HOURS_END = 8;
function isQuietHoursNow(): boolean {
  const localHour = (new Date().getUTCHours() + 5) % 24;
  return localHour >= QUIET_HOURS_START || localHour < QUIET_HOURS_END;
}

const DAILY_PUSH_CAP = 5;

// Web push (VAPID/aes128gcm) relies on Node's crypto.createECDH, not
// implemented in Deno — the actual send happens through Vercel's
// /api/push/send, same as notify-category-post.
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

async function sendToUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<{ sent: boolean; staleTokens: string[] }> {
  const { data: tokens } = await supabase.from("push_tokens").select("platform, token").eq("user_id", userId);
  if (!tokens || tokens.length === 0) return { sent: false, staleTokens: [] };

  let sent = false;
  const staleTokens: string[] = [];

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
          if (status === "error") staleTokens.push(row.token);
          else sent = true;
        } else if (row.platform === "web") {
          const result = await sendWebPush(row.token, { title, body, data });
          if (result.ok) sent = true;
          else if (result.statusCode === 404 || result.statusCode === 410) staleTokens.push(row.token);
        }
      } catch (err: any) {
        console.error("push send failed:", row.platform, err?.message || err);
      }
    }),
  );

  return { sent, staleTokens };
}

// Fires when run_ai_matching_for_item (supabase/migrations/20260924000000_ai_matching.sql)
// inserts a score >= 70 row into item_matches — notifies BOTH the lost item's
// owner and the found item's owner, each with their own message, that a
// possible match exists. Never states or implies ownership is confirmed.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const { match_id } = await req.json();
    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), { status: 400 });
    }

    const { data: match } = await supabase
      .from("item_matches")
      .select("id, score, lost_item_id, found_item_id")
      .eq("id", match_id)
      .maybeSingle();

    if (!match) {
      return new Response(JSON.stringify({ error: "match not found" }), { status: 404 });
    }

    const { data: items } = await supabase
      .from("items")
      .select("id, title, user_id")
      .in("id", [match.lost_item_id, match.found_item_id]);

    const lostItem = items?.find((i) => i.id === match.lost_item_id);
    const foundItem = items?.find((i) => i.id === match.found_item_id);
    if (!lostItem || !foundItem) {
      return new Response(JSON.stringify({ error: "item not found" }), { status: 404 });
    }

    if (isQuietHoursNow()) {
      return new Response(JSON.stringify({ sent: 0, skipped: "quiet_hours" }), { status: 200 });
    }

    const recipients = [
      { userId: lostItem.user_id, itemTitle: lostItem.title },
      { userId: foundItem.user_id, itemTitle: foundItem.title },
    ];

    const { data: recentSends } = await supabase
      .from("push_notification_log")
      .select("user_id")
      .eq("kind", "ai_match")
      .in("user_id", recipients.map((r) => r.userId))
      .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    const capped = new Set((recentSends ?? []).map((r) => r.user_id));

    const scoreRounded = Math.round(Number(match.score));
    const staleTokenIds: string[] = [];
    let sentCount = 0;
    const loggedUserIds: string[] = [];

    for (const recipient of recipients) {
      if (capped.has(recipient.userId)) continue;

      const body = `🤖 Мо барои эълони шумо "${recipient.itemTitle}" як мутобиқати эҳтимолӣ ёфтем (${scoreRounded}%)`;
      const result = await sendToUser(supabase, recipient.userId, "JUYO", body, {
        type: "ai_match",
        match_id: match.id,
      });

      staleTokenIds.push(...result.staleTokens);
      if (result.sent) sentCount++;
      loggedUserIds.push(recipient.userId);
    }

    if (staleTokenIds.length > 0) {
      await supabase.from("push_tokens").delete().in("token", staleTokenIds);
    }
    if (loggedUserIds.length > 0) {
      await supabase.from("push_notification_log").insert(loggedUserIds.map((user_id) => ({ user_id, kind: "ai_match" })));
    }

    return new Response(JSON.stringify({ sent: sentCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("notify-ai-match error:", err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || "unknown error" }), { status: 500 });
  }
});
