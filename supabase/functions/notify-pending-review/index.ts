import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://juyo.tj";
const PUSH_INTERNAL_SECRET = Deno.env.get("PUSH_INTERNAL_SECRET");

// The admin accounts (Clerk ids) that get these notifications — the same
// list as ADMIN_USER_IDS on the website. BUG FOUND 2026-10-15: this used to be
// one hardcoded id that has no profile in the database, so no admin ever
// received a "pending review" notification. Set ADMIN_USER_IDS as a function
// secret to change the list without a deploy.
const ADMIN_USER_IDS = (Deno.env.get("ADMIN_USER_IDS") ?? "user_3ImaBqNiOR3WoGCEBHgU0Acec2l,user_3Dqp9UtdA1pRMUZZwQaRCA8Jgek")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// see notify-category-post for why this relay exists (web push doesn't work in Deno).
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

type Message = { title: string; body: string; data: Record<string, string>; tag: string };

// Called by database triggers with the service-role key (verify_jwt = true):
//   { item_id }      a new listing waits for review   (trigger_notify_pending_review)
//   { new_user_id }  a new account was created         (trigger_notify_new_user)
// The admin's own phone (Expo) and Chrome (web push) get it.
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const { item_id, new_user_id } = await req.json();
    let message: Message;

    if (item_id) {
      const { data: item } = await supabase.from("items").select("id, title").eq("id", item_id).single();
      if (!item) return new Response(JSON.stringify({ error: "item not found" }), { status: 404 });
      message = {
        title: "🔴 Санҷиши дастӣ лозим аст",
        body: `Эълони нав дар интизори тасдиқ: "${item.title}"`,
        data: { type: "pending_review", item_id: item.id, url: `/admin/posts/${item.id}` },
        tag: "pending-review",
      };
    } else if (new_user_id) {
      // No name or email in the text: push services (Expo, Google, Apple) carry it.
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .or("status.is.null,status.neq.deleted");
      message = {
        title: "👤 Корбари нав",
        body: count ? `Корбари нав дар juyo бақайд гирифт. Ҳамагӣ: ${count}` : "Корбари нав дар juyo бақайд гирифт.",
        data: { type: "new_user", url: `/admin/users/${new_user_id}` },
        tag: `new-user-${new_user_id}`,
      };
    } else {
      return new Response(JSON.stringify({ error: "item_id or new_user_id required" }), { status: 400 });
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("platform, token")
      .in("user_id", ADMIN_USER_IDS);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    let sent = 0;
    const staleTokenIds: string[] = [];

    await Promise.all(
      tokens.map(async (row: { platform: string; token: string }) => {
        try {
          if (row.platform === "expo") {
            const res = await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ to: row.token, title: message.title, body: message.body, data: message.data, sound: "default", priority: "high" }),
            });
            const result = await res.json().catch(() => null);
            const status = result?.data?.status ?? result?.data?.[0]?.status;
            if (status === "error") {
              staleTokenIds.push(row.token);
            } else {
              sent++;
            }
          } else if (row.platform === "web") {
            // Distinct vibrate and tag — so these are told apart from regular notifications.
            const result = await sendWebPush(row.token, {
              title: message.title,
              body: message.body,
              data: message.data,
              vibrate: [400, 150, 400, 150, 400],
              tag: message.tag,
            });
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
    console.error("notify-pending-review error:", err?.message || err);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500 });
  }
});
