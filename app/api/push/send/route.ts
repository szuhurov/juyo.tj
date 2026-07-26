import { NextRequest, NextResponse } from "next/server";
import webpush, { WebPushError } from "web-push";

/**
 * Фиристодани воқеии як web push (аз тарафи браузер, на Expo). Ин марҳила
 * дар Deno (Supabase Edge Functions) кор намекунад — китобхонаи web-push
 * ба crypto.createECDH-и Node такя мекунад, ки дар Deno's node:crypto
 * polyfill татбиқ нашудааст ("Not implemented: crypto.ECDH"). Аз ин рӯ
 * функсияҳои огоҳинома (notify-verification, notify-category-post,
 * notify-qr-scan) касеро бояд бифиристанд муайян мекунанд, вале худи
 * фиристодан (рамзгузорӣ + дархост ба хидмати push) аз ин ҷо — runtime-и
 * воқеии Node-и Vercel, ки web-push дар он дуруст кор мекунад — иҷро мешавад.
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
    // urgency: "high" — то хидмати push онро тез расонад ва Android
    // эҳтимоли бештар барои нишон додани heads-up (пайдоиши фаврӣ дар
    // болои экран, бе кашидани notification shade) дошта бошад.
    await webpush.sendNotification(subscription, JSON.stringify(payload ?? {}), { urgency: "high" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 200 — статуси HTTP-и ин route-ро бо статуси push-и ноком омехта накунем;
    // 404/410 (абонемент бекор шудааст) барои даъвати edge function лозим аст.
    const statusCode = err instanceof WebPushError ? err.statusCode : undefined;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, statusCode, message }, { status: 200 });
  }
}
