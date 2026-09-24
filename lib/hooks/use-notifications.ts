"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { toast } from "sonner";

const POLL_MS = 20_000;
const TOAST_REMIND_MS = 60 * 60 * 1000; // Repeat the toast reminder if the user still hasn't seen it
const TOAST_SHOWN_STORAGE_KEY = "juyo_toast_last_shown";

export interface NotificationItem {
  /** `expiry_confirm` — the user's OWN post has 72 hours left before deletion
   *  and they must say "still needed" or "no". It has no separate table: like
   *  `category_post`, it is computed from the data itself.
   *  `ai_match` — a Phase 5 possible match (score >= 70) involving one of
   *  the user's own items; `itemId` is always THIS user's own item, so
   *  "View listing" still points at something they posted.
   *  `vip_status` — a Phase 6 subscription activated/expired notice. Has no
   *  associated item (`itemId` is `""`); links to `/vip` instead. */
  kind: "category_post" | "expiry_confirm" | "ai_match" | "vip_status" | "org_review_pending" | "org_review_result";
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
  /** Only for `ai_match` — the score (0-100) from item_matches. */
  matchScore?: number;
  /** Only for `vip_status` — the subscription's tier and which lifecycle event this is. */
  vipTier?: "vip" | "vvip";
  vipEventType?: "activated" | "expired";
  /** Only for `org_review_pending`/`org_review_result` — which organization,
   *  and (for a result) the outcome. Never "verified"/"verification" —
   *  organization approval is not ownership verification. */
  organizationId?: string;
  organizationName?: string;
  organizationReviewStatus?: "approved" | "rejected";
}

/** The read-state key for one notification — shared by the hook and its tests. */
export function notificationReadKey(kind: string, refId: string): string {
  return `${kind}:${refId}`;
}

function refIdOf(item: NotificationItem): string {
  return item.id.includes(":") ? item.id.split(":")[1] : item.id;
}

function readKeyOf(item: NotificationItem): string {
  return notificationReadKey(item.kind, refIdOf(item));
}

// Last time a toast was shown, for each ID — kept in localStorage so it
// isn't lost on a component reload/remount (this was exactly why the
// toast used to repeat every 20 seconds). This is a purely ephemeral
// toast-dedup nicety, not read/unread state, so it stays client-only.
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
  // Server-authoritative read state (notification_reads, via
  // get_my_notification_reads) — replaces the old localStorage-only
  // seenIds/openedIds, which never synced across devices and vanished on
  // cache clear. One set drives both the per-row "unread" dot/color AND
  // the bell badge count — there is no longer a separate "seen vs opened"
  // distinction (that split was UI-only complexity with no real state
  // behind it).
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set());
  // Last shown time of the toast for each ID (localStorage-based, not
  // useRef) — so that on a component remount (e.g. navigating between
  // pages) the same toast doesn't repeat every 20 seconds.
  const toastShownAt = useRef<Record<string, number>>(loadToastTimestamps());

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setReadKeys(new Set());
      setLoading(false);
      return;
    }
    const supabase = createClerkSupabaseClient(getToken);

    // get_my_category_notifications — new posts from other users in the
    // same categories that the user themself also has posts in.
    // get_my_ai_match_notifications — Phase 5 possible matches (score >= 70)
    // involving one of the user's own items.
    // get_my_notification_reads — this user's server-persisted read markers.
    // get_my_vip_notifications — Phase 6 subscription activated/expired events.
    // get_my_org_review_notifications — Phase 7, staff-facing: posts of
    // organizations the caller can approve/reject that are awaiting review.
    // get_my_org_review_results — Phase 7, poster-facing: the outcome of
    // their own post's organization association.
    const [
      { data: catData }, { data: matchData }, { data: vipData },
      { data: orgPendingData }, { data: orgResultData }, { data: readData },
    ] = await Promise.all([
      supabase.rpc("get_my_category_notifications", { p_limit: categoryLimit }),
      supabase.rpc("get_my_ai_match_notifications", { p_limit: categoryLimit }),
      supabase.rpc("get_my_vip_notifications", { p_limit: categoryLimit }),
      supabase.rpc("get_my_org_review_notifications", { p_limit: categoryLimit }),
      supabase.rpc("get_my_org_review_results", { p_limit: categoryLimit }),
      supabase.rpc("get_my_notification_reads", { p_limit: 500 }),
    ]);

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

    interface AiMatchRow {
      match_id: string;
      other_item_id: string;
      other_item_title: string | null;
      other_item_type?: "lost" | "found" | null;
      other_item_image_url: string | null;
      my_item_id: string;
      my_item_title: string | null;
      score: number | string;
      created_at: string;
    }

    const matchRows: NotificationItem[] = (matchData ?? []).map((row: AiMatchRow) => ({
      id: `ai_match:${row.match_id}`,
      kind: "ai_match" as const,
      // Points at the user's OWN item (the one they posted) — "View
      // listing" must never navigate to a listing they don't own.
      itemId: row.my_item_id,
      itemTitle: row.my_item_title ?? "",
      itemImageUrl: row.other_item_image_url,
      itemType: row.other_item_type ?? null,
      createdAt: row.created_at,
      matchScore: Math.round(Number(row.score)),
    }));

    interface VipNotificationRow {
      event_id: string;
      subscription_id: string;
      event_type: "activated" | "expired";
      tier: "vip" | "vvip";
      expires_at: string;
      created_at: string;
    }

    const vipRows: NotificationItem[] = (vipData ?? []).map((row: VipNotificationRow) => ({
      id: `vip_status:${row.event_id}`,
      kind: "vip_status" as const,
      itemId: "",
      itemTitle: (row.tier === 'vvip' ? 'VIP' : 'TOP'),
      itemImageUrl: null,
      createdAt: row.created_at,
      vipTier: row.tier,
      vipEventType: row.event_type,
    }));

    interface OrgReviewPendingRow {
      item_id: string;
      item_title: string;
      organization_id: string;
      organization_name: string;
      created_at: string;
    }

    const orgPendingRows: NotificationItem[] = (orgPendingData ?? []).map((row: OrgReviewPendingRow) => ({
      id: `org_review_pending:${row.item_id}`,
      kind: "org_review_pending" as const,
      // Points at the ITEM to review, not the caller's own post — the
      // "View" action for this kind goes to the org review queue, not
      // /items/[id] (handled in the notifications page).
      itemId: row.item_id,
      itemTitle: row.item_title ?? "",
      itemImageUrl: null,
      createdAt: row.created_at,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
    }));

    interface OrgReviewResultRow {
      item_id: string;
      item_title: string;
      organization_id: string;
      organization_name: string;
      organization_review_status: "approved" | "rejected";
      organization_reviewed_at: string;
    }

    const orgResultRows: NotificationItem[] = (orgResultData ?? []).map((row: OrgReviewResultRow) => ({
      id: `org_review_result:${row.item_id}`,
      kind: "org_review_result" as const,
      itemId: row.item_id,
      itemTitle: row.item_title ?? "",
      itemImageUrl: null,
      createdAt: row.organization_reviewed_at,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      organizationReviewStatus: row.organization_review_status,
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
    // whereas category posts and possible matches can wait. Matches, VIP
    // status, and organization-review events come right after (all are
    // stronger, more specific signals than a generic category post).
    const merged = [...expiryRows, ...vipRows, ...orgPendingRows, ...orgResultRows, ...matchRows, ...rows];

    const nextReadKeys = new Set(
      ((readData ?? []) as { kind: string; ref_id: string }[]).map((r) => notificationReadKey(r.kind, r.ref_id)),
    );

    // The toast for each ID fires once immediately, then doesn't repeat for
    // up to 1 hour — and once the user has already read it server-side, it
    // never repeats again; only genuinely NEW/unread notices trigger it.
    const now = Date.now();
    const timestamps = toastShownAt.current;
    let timestampsChanged = false;
    for (const r of merged) {
      if (nextReadKeys.has(readKeyOf(r))) continue;
      const lastShown = timestamps[r.id];
      if (lastShown && now - lastShown < TOAST_REMIND_MS) continue;
      toast.info(
        r.kind === "expiry_confirm"
          ? t("expiryToast").replace("%{title}", r.itemTitle)
          : r.kind === "ai_match"
            ? t("aiMatchToast").replace("%{title}", r.itemTitle)
            : r.kind === "vip_status"
              ? t(r.vipEventType === "expired" ? "vipExpiredToast" : "vipActivatedToast").replace("%{tier}", r.itemTitle)
              : r.kind === "org_review_pending"
                ? t("orgReviewPendingToast").replace("%{organization}", r.organizationName ?? "")
                : r.kind === "org_review_result"
                  ? t(r.organizationReviewStatus === "approved" ? "orgReviewApprovedToast" : "orgReviewRejectedToast").replace(
                      "%{organization}",
                      r.organizationName ?? "",
                    )
                  : t("categoryPostToast").replace("%{title}", r.itemTitle),
      );
      timestamps[r.id] = now;
      timestampsChanged = true;
    }
    if (timestampsChanged) saveToastTimestamps(timestamps);

    setItems(merged);
    setReadKeys(nextReadKeys);
    setLoading(false);
  }, [userId, getToken, t, categoryLimit]);

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

  // When one specific row in the list is opened — persisted server-side via
  // mark_notification_read, so it stays read across devices/reinstalls.
  const markOpened = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      const key = readKeyOf(item);
      setReadKeys((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));

      const supabase = createClerkSupabaseClient(getToken);
      supabase.rpc("mark_notification_read", { p_kind: item.kind, p_ref_id: refIdOf(item) }).then(({ error }) => {
        if (error) console.error("mark_notification_read:", error.message);
      });
    },
    [items, getToken],
  );

  // Marks all current rows as "read" at once (the "Mark all as read" button).
  const markAllOpened = useCallback(() => {
    if (items.length === 0) return;
    setReadKeys((prev) => {
      const next = new Set(prev);
      for (const item of items) next.add(readKeyOf(item));
      return next;
    });

    const supabase = createClerkSupabaseClient(getToken);
    supabase
      .rpc("mark_notifications_read", {
        p_kinds: items.map((i) => i.kind),
        p_ref_ids: items.map((i) => refIdOf(i)),
      })
      .then(({ error }) => {
        if (error) console.error("mark_notifications_read:", error.message);
      });
  }, [items, getToken]);

  const count = items.filter((item) => !readKeys.has(readKeyOf(item))).length;
  const isOpened = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      return item ? readKeys.has(readKeyOf(item)) : false;
    },
    [items, readKeys],
  );

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
      const refId = refIdOf(item);
      const { error } = await supabase.rpc("dismiss_notification", {
        p_kind: item.kind,
        p_ref_id: refId,
        // vip_status has no associated item (item.itemId is "" for it) —
        // "" isn't a valid uuid, so it must go through as null.
        p_item_id: item.itemId || null,
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

  return { items, count, loading, refetch: fetchAll, markOpened, markAllOpened, isOpened, dismissNotification, respondToExpiry };
}
