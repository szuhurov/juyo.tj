// Давраи ҳаёти эълон — ҳар рӯз соати 02:00 аз pg_cron (job #1) даъват мешавад.
// Ҳама чиз ХУДКОР аст: admin ҳеҷ чиз намефиристад.
//
// ДУ МАРҲИЛА, дар як иҷро:
//
//   A) То `expires_at` камтар аз 72 соат мондааст ва огоҳинома ҳанӯз
//      нарафтааст → ба соҳиб push меравад ва `expiry_notified_at` сабт
//      мешавад. Эълон ҳанӯз ЗИНДА аст.
//
//   B) `expires_at` расид → эълон ВОҚЕАН нест мешавад: аксҳо аз Storage,
//      сатр аз база.
//
// «Ҳанӯз лозим»-ро корбар мезанад → app/api/items/[id]/expiry мӯҳлатро аз
// нав мегузорад ва `expiry_notified_at`-ро холӣ мекунад, пас марҳилаи B
// ҳаргиз ба он намерасад.
//
// Агар корбар огоҳинома фаъол накарда бошад, марҳилаи A ба ӯ чизе намедиҳад
// ва эълон дар `expires_at` бе хабар нест мешавад — қарори соҳиби барнома.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://juyo.tj";
const PUSH_INTERNAL_SECRET = Deno.env.get("PUSH_INTERNAL_SECRET");

/** Чанд соат ПЕШ аз мӯҳлат огоҳинома меравад. */
const WARN_BEFORE_HOURS = 72;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web push такя ба crypto.createECDH дорад, ки дар Deno татбиқ нашудааст —
// фиристодани воқеӣ аз /api/push/send-и Vercel меравад (ниг. notify-category-post).
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
    // ─── МАРҲИЛАИ A: огоҳии пешакӣ (72 соат мондааст) ─────────────────────
    const warnUntil = new Date(now.getTime() + WARN_BEFORE_HOURS * 3600_000).toISOString();

    const { data: warnItems, error: warnError } = await supabase
      .from("items")
      .select("id, title, user_id")
      .eq("status", "active")
      .not("expires_at", "is", null)
      .gt("expires_at", nowIso)        // ҳанӯз нарасидааст
      .lte("expires_at", warnUntil)     // вале камтар аз 72 соат мондааст
      .is("expiry_notified_at", null);

    if (warnError) throw warnError;

    let notified = 0;
    let pushSent = 0;

    for (const item of warnItems ?? []) {
      if (!item.user_id) continue; // эълони меҳмон — соҳиби хабардоршаванда нест

      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token")
        .eq("user_id", item.user_id);

      // Огоҳинома фаъол нест — ҳеҷ чиз намефиристем ва БЕЛГӢ ҳам намегузорем.
      // Эълон дар `expires_at` бе хабар нест мешавад (марҳилаи B).
      if (!tokens?.length) continue;

      // Белгӣ ПЕШ аз фиристодан: агар push ноком шавад, cron набояд ҳар шаб
      // ҳамон огоҳиномаро такрор кунад. Корбар онро дар саҳифаи
      // огоҳиномаҳо ба ҳар ҳол мебинад (он аз `expiry_notified_at` меояд).
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

    // ─── МАРҲИЛАИ B: мӯҳлат расид → нест кардани воқеӣ ────────────────────
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

      // item_images бо CASCADE меравад
      const { error: deleteError } = await supabase.from("items").delete().eq("id", itemId);
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
