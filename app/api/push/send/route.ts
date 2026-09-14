import { NextRequest, NextResponse } from "next/server";
import webpush, { WebPushError } from "web-push";

/**
 * Actually sends a single web push (from the browser, not Expo). This step
 * doesn't work in Deno (Supabase Edge Functions) — the web-push library
 * relies on Node's crypto.createECDH, which isn't implemented in Deno's
 * node:crypto polyfill ("Not implemented: crypto.ECDH"). So the
 * notification functions (notify-verification, notify-category-post,
 * notify-qr-scan) determine who to send to, but the actual sending
 * (encryption + request to the push service) runs from here — a real
 * Node runtime on Vercel, where web-push works correctly.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:s.zuhurov@outlook.com";
const PUSH_INTERNAL_SECRET = process.env.PUSH_INTERNAL_SECRET;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function POST(req: NextRequest) {
  if (!PUSH_INTERNAL_SECRET || req.headers.get("x-internal-secret") !== PUSH_INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 500 });
  }

  const { subscription, payload } = await req.json();
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "subscription required" }, { status: 400 });
  }

  try {
    // urgency: "high" — so the push service delivers it quickly and Android
    // is more likely to show it heads-up (appearing instantly at the
    // top of the screen, without pulling down the notification shade).
    await webpush.sendNotification(subscription, JSON.stringify(payload ?? {}), { urgency: "high" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 200 — so we don't conflate this route's HTTP status with the push failure status;
    // 404/410 (subscription revoked) is needed by the calling edge function.
    const statusCode = err instanceof WebPushError ? err.statusCode : undefined;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, statusCode, message }, { status: 200 });
  }
}
