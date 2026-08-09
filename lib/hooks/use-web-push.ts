"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type WebPushStatus = "unsupported" | "denied" | "default" | "granted";

export function useWebPush() {
  const { userId, getToken } = useAuth();
  const [status, setStatus] = useState<WebPushStatus>("default");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    // Хониши иҷозати браузер (система берун аз React) ва синхронизатсияи он.
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("unsupported");
      return;
    }
    const permission = Notification.permission as WebPushStatus;
    setStatus(permission);
    if (permission === "granted") {
      navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => setSubscribed(!!subscription))
        .catch(() => setSubscribed(false));
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!userId || !VAPID_PUBLIC_KEY) return false;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;

    const permission = await Notification.requestPermission();
    setStatus(permission as WebPushStatus);
    if (permission !== "granted") return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      const token = await getToken({ template: "supabase" });
      if (!token) return false;
      const supabase = createClerkSupabaseClient(token);
      await supabase
        .from("push_tokens")
        .upsert(
          { user_id: userId, platform: "web", token: JSON.stringify(subscription) },
          { onConflict: "user_id,token" },
        );
      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("web push subscribe failed:", err);
      return false;
    }
  }, [userId, getToken]);

  // Браузер иҷозати Notification-ро аз тарафи сайт бекор карда наметавонад
  // (танҳо худи корбар аз танзимоти браузер) — вале аз pushManager
  // unsubscribe кардан мумкин аст, то push дигар нарасад.
  const unsubscribe = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const token = await getToken({ template: "supabase" });
        if (token) {
          const supabase = createClerkSupabaseClient(token);
          await supabase
            .from("push_tokens")
            .delete()
            .eq("token", JSON.stringify(subscription));
        }
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      return true;
    } catch (err) {
      console.error("web push unsubscribe failed:", err);
      return false;
    }
  }, [getToken]);

  return { status, subscribed, subscribe, unsubscribe };
}
