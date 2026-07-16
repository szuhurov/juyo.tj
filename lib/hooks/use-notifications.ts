"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { toast } from "sonner";

const POLL_MS = 20_000;
const TOAST_REMIND_MS = 60 * 60 * 1000; // Такрори ёдоварии toast, агар корбар ҳанӯз надида бошад
const SEEN_STORAGE_KEY = "juyo_seen_notification_ids";
const OPENED_STORAGE_KEY = "juyo_opened_notification_ids";
const TOAST_SHOWN_STORAGE_KEY = "juyo_toast_last_shown";

export interface NotificationItem {
  id: string;
  kind: "category_post";
  itemId: string;
  itemTitle: string;
  itemImageUrl: string | null;
  createdAt: string;
  posterName?: string | null;
  posterAvatar?: string | null;
}

function loadIds(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

// Вақти охирини нишон додани toast барои ҳар ID — дар localStorage, то
// ҳангоми reload/remount-и компонент гум нашавад (ана ҳамин боис буд, ки
// toast ҳар 20 сония такрор мешуд).
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
  // seenIds — назорати рақами badge-и занг (якбора, ҳангоми click ба занг).
  const [seenIds, setSeenIds] = useState<Set<string>>(() => loadIds(SEEN_STORAGE_KEY));
  // openedIds — назорати ранги ҳар сатр дар рӯйхат (алоҳида, ҳангоми кушодани ҳамон сатр).
  const [openedIds, setOpenedIds] = useState<Set<string>>(() => loadIds(OPENED_STORAGE_KEY));
  // Вақти охирини нишондодашудаи toast барои ҳар ID (localStorage-based, на
  // useRef) — то ҳангоми remount-и компонент (масалан гузариш байни
  // саҳифаҳо) toast-и якхела ҳар 20 сония такрор нашавад.
  const toastShownAt = useRef<Record<string, number>>(loadToastTimestamps());

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const token = await getToken({ template: "supabase" });
    if (!token) return;
    const supabase = createClerkSupabaseClient(token);

    // get_my_category_notifications — эълонҳои нави дигар корбарон дар
    // ҳамон категорияҳое, ки худи корбар низ эълон дорад.
    const { data: catData } = await supabase.rpc("get_my_category_notifications", { p_limit: categoryLimit });

    const rows: NotificationItem[] = (catData ?? []).map((row: any) => ({
      id: `category:${row.item_id}`,
      kind: "category_post" as const,
      itemId: row.item_id,
      itemTitle: row.item_title ?? "",
      itemImageUrl: row.item_image_url ?? null,
      createdAt: row.created_at,
      posterName: `${row.poster_first_name ?? ""} ${row.poster_last_name ?? ""}`.trim() || null,
      posterAvatar: row.poster_avatar_url ?? null,
    }));

    // Toast барои ҳар ID танҳо якбор фавран мебарояд, баъд on то 1 соат
    // такрор намешавад — ва агар корбар аллакай онро дида бошад (seenIds),
    // дигар ҳаргиз такрор намешавад, танҳо огоҳиномаҳои воқеан НАВ мебароянд.
    const now = Date.now();
    const timestamps = toastShownAt.current;
    let timestampsChanged = false;
    for (const r of rows) {
      if (seenIds.has(r.id)) continue;
      const lastShown = timestamps[r.id];
      if (lastShown && now - lastShown < TOAST_REMIND_MS) continue;
      toast.info(t("categoryPostToast").replace("%{title}", r.itemTitle));
      timestamps[r.id] = now;
      timestampsChanged = true;
    }
    if (timestampsChanged) saveToastTimestamps(timestamps);

    setItems(rows);
    setLoading(false);
  }, [userId, getToken, t, categoryLimit, seenIds]);

  useEffect(() => {
    fetchAll();
    if (!userId) return;
    const interval = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(interval);
  }, [userId, fetchAll]);

  // Вақте ки корбар ба занг click мекунад, ҳамаи огоҳиномаҳои ҳозираро
  // "дида шуд" мегузорем — рақами badge то дархости воқеан нав пайдо
  // нашуда, боз намепайдояд.
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

  // Вақте ки як сатри мушаххас дар рӯйхат кушода мешавад — танҳо ранги
  // ҲАМОН сатр ба ҳолати одӣ мегузарад (аз badge-и умумӣ ҷудо).
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

  const count = items.filter((item) => !seenIds.has(item.id)).length;
  const isOpened = useCallback((id: string) => openedIds.has(id), [openedIds]);

  // Нест кардани як огоҳинома аз рӯйхати корбар — dismiss_notification RPC
  // ҳамзамон дар dismissed_notifications (то дигар барнагардад) ва
  // deleted_notifications_archive (барои admin) сабт мекунад.
  const dismissNotification = useCallback(
    async (item: NotificationItem) => {
      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);
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

  return { items, count, loading, refetch: fetchAll, markAllSeen, markOpened, isOpened, dismissNotification };
}
