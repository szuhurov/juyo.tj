"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { toast } from "sonner";

const POLL_MS = 20_000;
const SEEN_STORAGE_KEY = "juyo_seen_verification_ids";

export interface PendingVerification {
  attemptId: string;
  itemId: string;
  itemTitle: string;
  status: "pending_review" | "passed" | "rejected";
  createdAt: string;
  claimantName: string | null;
  claimantAvatar: string | null;
}

function loadSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function usePendingVerifications() {
  const { userId, getToken } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => loadSeenIds());
  const seenPendingIds = useRef<Set<string> | null>(null);

  const fetchPending = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const token = await getToken({ template: "supabase" });
    if (!token) return;
    const supabase = createClerkSupabaseClient(token);
    // get_my_verification_attempts — ҳама эълонҳои корбар якҷоя, ҳам
    // pending_review, ҳам аллакай баррасишуда (таърих), то рӯйхат баъд аз
    // тасдиқ/рад нест нашавад. Тасдиқ/рад аз ин ҷо иҷро намешавад — он
    // танҳо дар саҳифаи худи эълон (VerificationGate) ҷой дорад.
    const { data } = await supabase.rpc("get_my_verification_attempts", { p_limit: 50 });

    const rows: PendingVerification[] = (data ?? []).map((row: any) => ({
      attemptId: row.id,
      itemId: row.item_id,
      itemTitle: row.item_title ?? "",
      status: row.status,
      createdAt: row.created_at,
      claimantName: `${row.matched_first_name ?? ""} ${row.matched_last_name ?? ""}`.trim() || null,
      claimantAvatar: row.matched_avatar_url ?? null,
    }));

    // Пас аз бори аввал, ҳар savol-и nav-ро бо toast огоҳ мекунем (танҳо
    // барои pending — таърихи аллакай баррасишуда набояд боз toast диҳад).
    const pendingNow = rows.filter((r) => r.status === "pending_review");
    if (seenPendingIds.current) {
      const fresh = pendingNow.filter((r) => !seenPendingIds.current!.has(r.attemptId));
      for (const r of fresh) {
        toast.info(t("verifyNewAttemptToast").replace("%{title}", r.itemTitle));
      }
    }
    seenPendingIds.current = new Set(pendingNow.map((r) => r.attemptId));

    setItems(rows);
    setLoading(false);
  }, [userId, getToken, t]);

  useEffect(() => {
    fetchPending();
    if (!userId) return;
    const interval = setInterval(fetchPending, POLL_MS);
    return () => clearInterval(interval);
  }, [userId, fetchPending]);

  // Вақте ки корбар менюи зангро мекушояд, ҳамаи pending-ҳои ҳозираро
  // "дида шуд" мегузорем — badge то дархости воқеан нав пайдо нашуда, боз
  // намепайдояд.
  const markAllSeen = useCallback(() => {
    setSeenIds((prev) => {
      const next = new Set(prev);
      for (const item of items) {
        if (item.status === "pending_review") next.add(item.attemptId);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  }, [items]);

  const count = items.filter(
    (item) => item.status === "pending_review" && !seenIds.has(item.attemptId),
  ).length;

  return { items, count, loading, refetch: fetchPending, markAllSeen };
}
