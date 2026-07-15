"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { toast } from "sonner";

const POLL_MS = 20_000;
const SEEN_STORAGE_KEY = "juyo_seen_notification_ids";
const OPENED_STORAGE_KEY = "juyo_opened_notification_ids";

export interface NotificationItem {
  id: string;
  kind: "verification" | "category_post";
  itemId: string;
  itemTitle: string;
  itemImageUrl: string | null;
  createdAt: string;
  // Танҳо барои kind === "verification"
  status?: "pending_review" | "passed" | "rejected";
  claimantName?: string | null;
  claimantAvatar?: string | null;
  // Танҳо барои kind === "category_post"
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

// Огоҳиномае, ки то ҳанӯз "дида нашуда" ҳисоб мешавад — pending_review-и
// санҷиш ё ҳар эълони нави категория (QR scan қасдан ин ҷо нест, танҳо push аст).
function isUnseenCandidate(item: NotificationItem): boolean {
  return item.kind === "category_post" || item.status === "pending_review";
}

export function useNotifications(
  options: { verifyLimit?: number; categoryLimit?: number } = {},
) {
  const { verifyLimit = 50, categoryLimit = 20 } = options;
  const { userId, getToken } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  // seenIds — назорати рақами badge-и занг (якбора, ҳангоми click ба занг).
  const [seenIds, setSeenIds] = useState<Set<string>>(() => loadIds(SEEN_STORAGE_KEY));
  // openedIds — назорати ранги ҳар сатр дар рӯйхат (алоҳида, ҳангоми кушодани ҳамон сатр).
  const [openedIds, setOpenedIds] = useState<Set<string>>(() => loadIds(OPENED_STORAGE_KEY));
  const seenNotifiedIds = useRef<Set<string> | null>(null);

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const token = await getToken({ template: "supabase" });
    if (!token) return;
    const supabase = createClerkSupabaseClient(token);

    const [{ data: verifData }, { data: catData }] = await Promise.all([
      // get_my_verification_attempts — ҳама pending_review + таърихи
      // баррасишуда. Тасдиқ/рад аз ин ҷо иҷро намешавад — он танҳо дар
      // саҳифаи худи эълон (VerificationGate) ҷой дорад.
      supabase.rpc("get_my_verification_attempts", { p_limit: verifyLimit }),
      // get_my_category_notifications — эълонҳои нави дигар корбарон дар
      // ҳамон категорияҳое, ки худи корбар низ эълон дорад.
      supabase.rpc("get_my_category_notifications", { p_limit: categoryLimit }),
    ]);

    const verifRows: NotificationItem[] = (verifData ?? []).map((row: any) => ({
      id: `verify:${row.id}`,
      kind: "verification" as const,
      itemId: row.item_id,
      itemTitle: row.item_title ?? "",
      itemImageUrl: row.item_image_url ?? null,
      createdAt: row.created_at,
      status: row.status,
      claimantName: `${row.matched_first_name ?? ""} ${row.matched_last_name ?? ""}`.trim() || null,
      claimantAvatar: row.matched_avatar_url ?? null,
    }));

    const catRows: NotificationItem[] = (catData ?? []).map((row: any) => ({
      id: `category:${row.item_id}`,
      kind: "category_post" as const,
      itemId: row.item_id,
      itemTitle: row.item_title ?? "",
      itemImageUrl: row.item_image_url ?? null,
      createdAt: row.created_at,
      posterName: `${row.poster_first_name ?? ""} ${row.poster_last_name ?? ""}`.trim() || null,
      posterAvatar: row.poster_avatar_url ?? null,
    }));

    const rows = [...verifRows, ...catRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Пас аз бори аввал, ҳар чизи нав-ро бо toast огоҳ мекунем.
    const candidates = rows.filter(isUnseenCandidate);
    if (seenNotifiedIds.current) {
      const fresh = candidates.filter((r) => !seenNotifiedIds.current!.has(r.id));
      for (const r of fresh) {
        toast.info(
          r.kind === "verification"
            ? t("verifyNewAttemptToast").replace("%{title}", r.itemTitle)
            : t("categoryPostToast").replace("%{title}", r.itemTitle),
        );
      }
    }
    seenNotifiedIds.current = new Set(candidates.map((r) => r.id));

    setItems(rows);
    setLoading(false);
  }, [userId, getToken, t, verifyLimit, categoryLimit]);

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
      for (const item of items) {
        if (isUnseenCandidate(item)) next.add(item.id);
      }
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

  const count = items.filter((item) => isUnseenCandidate(item) && !seenIds.has(item.id)).length;
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
        p_related_name: item.kind === "verification" ? item.claimantName ?? null : item.posterName ?? null,
        p_related_avatar: item.kind === "verification" ? item.claimantAvatar ?? null : item.posterAvatar ?? null,
        p_status: item.kind === "verification" ? item.status ?? null : null,
      });
      if (error) throw error;
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    },
    [getToken],
  );

  return { items, count, loading, refetch: fetchAll, markAllSeen, markOpened, isOpened, dismissNotification };
}
