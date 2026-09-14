"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { toast } from "sonner";

const POLL_MS = 20_000;
const TOAST_REMIND_MS = 60 * 60 * 1000; // Repeat the toast reminder if the user still hasn't seen it
const SEEN_STORAGE_KEY = "juyo_seen_notification_ids";
const OPENED_STORAGE_KEY = "juyo_opened_notification_ids";
const TOAST_SHOWN_STORAGE_KEY = "juyo_toast_last_shown";

export interface NotificationItem {
  /** `expiry_confirm` — the user's OWN post has 72 hours left before deletion
   *  and they must say "still needed" or "no". It has no separate table: like
   *  `category_post`, it is computed from the data itself. */
  kind: "category_post" | "expiry_confirm";
  id: string;
  itemId: string;
  itemTitle: string;
  itemImageUrl: string | null;
  itemType?: "lost" | "found" | null;
  createdAt: string;
  posterName?: string | null;
  posterAvatar?: string | null;
  /** Only for `expiry_confirm` — the deletion moment (`items.expires_at`). */
  expiryDeadline?: string;
}

function loadIds(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

// Last time a toast was shown, for each ID — kept in localStorage so it
// isn't lost on a component reload/remount (this was exactly why the
// toast used to repeat every 20 seconds).
function loadToastTimestamps(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(TOAST_SHOWN_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveToastTimestamps(map: Record<string, number>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOAST_SHOWN_STORAGE_KEY, JSON.stringify(map));
}

export function useNotifications(options: { categoryLimit?: number } = {}) {
  const { categoryLimit = 20 } = options;
  const { userId, getToken } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  // seenIds — controls the bell badge count (cleared all at once, on clicking the bell).
  const [seenIds, setSeenIds] = useState<Set<string>>(() => loadIds(SEEN_STORAGE_KEY));
  // openedIds — controls each row's color in the list (individually, when that row is opened).
  const [openedIds, setOpenedIds] = useState<Set<string>>(() => loadIds(OPENED_STORAGE_KEY));
  // Last shown time of the toast for each ID (localStorage-based, not
  // useRef) — so that on a component remount (e.g. navigating between
  // pages) the same toast doesn't repeat every 20 seconds.
  const toastShownAt = useRef<Record<string, number>>(loadToastTimestamps());

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const supabase = createClerkSupabaseClient(getToken);

    // get_my_category_notifications — new posts from other users in the
    // same categories that the user themself also has posts in.
    const { data: catData } = await supabase.rpc("get_my_category_notifications", { p_limit: categoryLimit });

    interface CategoryNotificationRow {
      item_id: string;
      item_title: string | null;
      item_image_url: string | null;
      created_at: string;
      poster_first_name: string | null;
      poster_last_name: string | null;
      poster_avatar_url: string | null;
      item_type?: "lost" | "found" | null;
    }

    const rows: NotificationItem[] = (catData ?? []).map((row: CategoryNotificationRow) => ({
      id: `category:${row.item_id}`,
      kind: "category_post" as const,
      itemId: row.item_id,
      itemTitle: row.item_title ?? "",
      itemImageUrl: row.item_image_url ?? null,
      itemType: row.item_type ?? null,
      createdAt: row.created_at,
      posterName: `${row.poster_first_name ?? ""} ${row.poster_last_name ?? ""}`.trim() || null,
      posterAvatar: row.poster_avatar_url ?? null,
    }));

    // The user's OWN posts that received a "72 hours left" notice and
    // haven't been deleted yet. The two conditions have two meanings:
    //   expiry_notified_at not null  → the notice was sent (a PAST moment)
    //   expires_at > now             → still alive (a FUTURE moment)
    // RLS is sufficient — the user sees their own rows, `supabaseAdmin` isn't needed.
    const { data: expiring } = await supabase
      .from("items")
      .select("id, title, expires_at, expiry_notified_at, type, item_images(image_url)")
      .eq("user_id", userId)
      .not("expiry_notified_at", "is", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true });

    interface ExpiringRow {
      id: string;
      title: string | null;
      expires_at: string;
      expiry_notified_at: string;
      type?: "lost" | "found" | null;
      item_images?: { image_url: string }[] | null;
    }

    const expiryRows: NotificationItem[] = (expiring ?? []).map((row: ExpiringRow) => ({
      id: `expiry:${row.id}`,
      kind: "expiry_confirm" as const,
      itemId: row.id,
      itemTitle: row.title ?? "",
      itemImageUrl: row.item_images?.[0]?.image_url ?? null,
      itemType: row.type ?? null,
      // The list shows the time the notice ARRIVED…
      createdAt: row.expiry_notified_at,
      // …but the "how many hours left" count is derived from the DELETION moment.
      expiryDeadline: row.expires_at,
    }));

    // The deletion notice is ALWAYS at the top — it's time-limited (72 hours),
    // whereas category posts can wait.
    const merged = [...expiryRows, ...rows];

    // The toast for each ID fires once immediately, then doesn't repeat for
    // up to 1 hour — and once the user has already seen it (seenIds), it
    // never repeats again; only genuinely NEW notices trigger it.
    const now = Date.now();
    const timestamps = toastShownAt.current;
    let timestampsChanged = false;
    for (const r of merged) {
      if (seenIds.has(r.id)) continue;
      const lastShown = timestamps[r.id];
      if (lastShown && now - lastShown < TOAST_REMIND_MS) continue;
      toast.info(
        r.kind === "expiry_confirm"
          ? t("expiryToast").replace("%{title}", r.itemTitle)
          : t("categoryPostToast").replace("%{title}", r.itemTitle),
      );
      timestamps[r.id] = now;
      timestampsChanged = true;
    }
    if (timestampsChanged) saveToastTimestamps(timestamps);

    setItems(merged);
    setLoading(false);
  }, [userId, getToken, t, categoryLimit, seenIds]);

  useEffect(() => {
    // Initial load on mount/when userId changes — inside fetchAll, the
    // "no user" branch updates state synchronously before any await, which
    // is correct for a data-loading effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
    if (!userId) return;
    const interval = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(interval);
  }, [userId, fetchAll]);

  // When the user clicks the bell, we mark all current notifications as
  // "seen" — the badge count won't reappear until an actually new request comes in.
  const markAllSeen = useCallback(() => {
    setSeenIds((prev) => {
      const next = new Set(prev);
      for (const item of items) next.add(item.id);
      if (typeof window !== "undefined") {
        localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  }, [items]);

  // When a specific row in the list is opened — only THAT row's color
  // changes to normal (separate from the overall badge).
  const markOpened = useCallback((id: string) => {
    setOpenedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      if (typeof window !== "undefined") {
        localStorage.setItem(OPENED_STORAGE_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  }, []);

  // Marks all current rows as "read" at once (the
  // "Mark all as read" button).
  const markAllOpened = useCallback(() => {
    setOpenedIds((prev) => {
      const next = new Set(prev);
      for (const item of items) next.add(item.id);
      if (typeof window !== "undefined") {
        localStorage.setItem(OPENED_STORAGE_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  }, [items]);

  const count = items.filter((item) => !seenIds.has(item.id)).length;
  const isOpened = useCallback((id: string) => openedIds.has(id), [openedIds]);

  // Removing one notification from the user's list — the dismiss_notification
  // RPC records it simultaneously in dismissed_notifications (so it doesn't
  // come back) and deleted_notifications_archive (for admin).
  const dismissNotification = useCallback(
    async (item: NotificationItem) => {
      // The expiry notice CANNOT be dismissed: dismissing it wouldn't save
      // the post — the cron will delete it after 72 hours regardless.
      // The user must choose "Keep" or "No".
      if (item.kind === "expiry_confirm") return;

      const supabase = createClerkSupabaseClient(getToken);
      const refId = item.id.includes(":") ? item.id.split(":")[1] : item.id;
      const { error } = await supabase.rpc("dismiss_notification", {
        p_kind: item.kind,
        p_ref_id: refId,
        p_item_id: item.itemId,
        p_item_title: item.itemTitle,
        p_related_name: item.posterName ?? null,
        p_related_avatar: item.posterAvatar ?? null,
        p_status: null,
      });
      if (error) throw error;
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    },
    [getToken],
  );

  /** The owner's response to the expiry notice. `keep` — one more period, `delete` — deletes
   *  immediately. The route itself verifies ownership against the database. */
  const respondToExpiry = useCallback(
    async (item: NotificationItem, action: "keep" | "delete") => {
      const token = await getToken();
      const res = await fetch(`/api/items/${item.itemId}/expiry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      // The post list has changed — open pages should refresh.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("items-updated"));
      }
    },
    [getToken],
  );

  return { items, count, loading, refetch: fetchAll, markAllSeen, markOpened, markAllOpened, isOpened, dismissNotification, respondToExpiry };
}
