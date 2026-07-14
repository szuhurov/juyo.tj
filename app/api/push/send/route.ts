import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

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
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@juyo.tj";
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
    await webpush.sendNotification(subscription, JSON.stringify(payload ?? {}));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // 200 — статуси HTTP-и ин route-ро бо статуси push-и ноком омехта накунем;
    // 404/410 (абонемент бекор шудааст) барои даъвати edge function лозим аст.
    return NextResponse.json(
      { ok: false, statusCode: err?.statusCode, message: err?.message },
      { status: 200 },
    );
  }
}
