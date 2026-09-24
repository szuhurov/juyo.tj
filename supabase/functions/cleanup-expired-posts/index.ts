// Listing lifecycle — called every day at 02:00 by pg_cron (job #1).
// Everything is AUTOMATIC: the admin doesn't send anything manually.
//
// TWO STAGES, in one run:
//
//   A) While `expires_at` has less than 72 hours left and the notification
//      hasn't gone out yet → a push goes to the owner and `expiry_notified_at`
//      is recorded. The listing is still ALIVE at this point.
//
//   B) `expires_at` is reached → the listing is ACTUALLY deleted: images
//      from Storage, the row from the database.
//
// If the user clicks "Still needed" → app/api/items/[id]/expiry resets the
// deadline and clears `expiry_notified_at`, so stage B never reaches it.
//
// If the user hasn't enabled notifications, stage A gives them nothing and
// the listing is deleted at `expires_at` without any warning — that's the
// app owner's deliberate decision.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://juyo.tj";
const PUSH_INTERNAL_SECRET = Deno.env.get("PUSH_INTERNAL_SECRET");

/** How many hours BEFORE the deadline the notification goes out. */
const WARN_BEFORE_HOURS = 72;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web push relies on crypto.createECDH, which isn't implemented in Deno —
// the actual sending happens through Vercel's /api/push/send (see notify-category-post).
async function sendWebPush(token: string, payload: object) {
  try {
    const res = await fetch(`${SITE_URL}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": PUSH_INTERNAL_SECRET ?? "" },
      body: JSON.stringify({ subscription: JSON.parse(token), payload }),
    });
    return await res.json().catch(() => ({ ok: false }));
  } catch (err) {
    console.error("push relay failed:", (err as Error).message);
    return { ok: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    // ─── STAGE A: advance warning (72 hours left) ─────────────────────
    const warnUntil = new Date(now.getTime() + WARN_BEFORE_HOURS * 3600_000).toISOString();

    const { data: warnItems, error: warnError } = await supabase
      .from("items")
      .select("id, title, user_id")
      .eq("status", "active")
      .not("expires_at", "is", null)
      .gt("expires_at", nowIso)        // hasn't been reached yet
      .lte("expires_at", warnUntil)     // but has less than 72 hours left
      .is("expiry_notified_at", null);

    if (warnError) throw warnError;

    let notified = 0;
    let pushSent = 0;

    for (const item of warnItems ?? []) {
      if (!item.user_id) continue; // guest listing — no owner to notify

      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token")
        .eq("user_id", item.user_id);

      // Notifications aren't enabled — we send nothing and also don't set the MARKER.
      // The listing gets deleted at `expires_at` without any warning (stage B).
      if (!tokens?.length) continue;

      // Mark it BEFORE sending: if the push fails, the cron shouldn't repeat
      // the same notification every night. The user will see it on the
      // notifications page regardless (it's driven by `expiry_notified_at`).
      const { error: markError } = await supabase
        .from("items")
        .update({ expiry_notified_at: nowIso })
        .eq("id", item.id);

      if (markError) {
        console.error(`mark failed for ${item.id}:`, markError.message);
        continue;
      }
      notified++;

      const stale: string[] = [];
      for (const row of tokens) {
        const result = await sendWebPush(row.token, {
          title: item.title,
          body: "Эълони шумо ба зудӣ нест мешавад. Ашё ҳанӯз лозим аст?",
          url: "/notifications",
          tag: `expiry-${item.id}`,
        });
        if (result?.ok) pushSent++;
        else if (result?.statusCode === 404 || result?.statusCode === 410) stale.push(row.token);
      }
      if (stale.length) await supabase.from("push_tokens").delete().in("token", stale);
    }

    // ─── STAGE B: deadline reached → actual deletion ────────────────────
    const { data: expiredItems, error: expiredError } = await supabase
      .from("items")
      .select("id")
      .not("expires_at", "is", null)
      .lte("expires_at", nowIso);

    if (expiredError) throw expiredError;

    let deleted = 0;
    let storageErrors = 0;

    for (const { id: itemId } of expiredItems ?? []) {
      const { data: images } = await supabase
        .from("item_images")
        .select("image_url")
        .eq("item_id", itemId);

      if (images?.length) {
        const filePaths = images
          .map((img: { image_url: string }) => {
            try {
              const parts = new URL(img.image_url).pathname.split("/public/items/");
              return parts.length > 1 ? parts[1] : null;
            } catch {
              return null;
            }
          })
          .filter(Boolean) as string[];

        if (filePaths.length) {
          const { error: storageError } = await supabase.storage.from("items").remove(filePaths);
          if (storageError) {
            console.error(`storage error for ${itemId}:`, storageError.message);
            storageErrors++;
          }
        }
      }

      // item_images is removed via CASCADE. expire_item (Phase 9A,
      // 20260930000002_analytics_foundation.sql) replaces a raw delete —
      // it records an 'expired' item_lifecycle_events row in the same
      // statement's trigger firing, so expiry history is never lost the
      // way a plain `.delete()` here would lose it.
      const { error: deleteError } = await supabase.rpc("expire_item", { p_item_id: itemId });
      if (deleteError) console.error(`delete error for ${itemId}:`, deleteError.message);
      else deleted++;
    }

    console.log(
      `expiry: notified=${notified} push=${pushSent} deleted=${deleted} storageErrors=${storageErrors}`,
    );

    return new Response(
      JSON.stringify({ success: true, notified, pushSent, deleted, storageErrors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = (error as Error).message;
    console.error("cleanup-expired-posts error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
