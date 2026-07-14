"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { toast } from "sonner";

const POLL_MS = 20_000;

export interface VerificationAnswer {
  question_id: string;
  question_text: string;
  answer_type: string;
  given_answer: string;
}

export interface PendingVerification {
  attemptId: string;
  itemId: string;
  itemTitle: string;
  answers: VerificationAnswer[];
  status: "pending_review" | "passed" | "rejected";
  createdAt: string;
  claimantPhone: string | null;
  matchedName: string | null;
}

export function usePendingVerifications() {
  const { userId, getToken } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
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
    // тасдиқ/рад нест нашавад.
    const { data } = await supabase.rpc("get_my_verification_attempts", { p_limit: 50 });

    const rows: PendingVerification[] = (data ?? []).map((row: any) => ({
      attemptId: row.id,
      itemId: row.item_id,
      itemTitle: row.item_title ?? "",
      answers: row.answers ?? [],
      status: row.status,
      createdAt: row.created_at,
      claimantPhone: row.claimant_phone,
      matchedName: row.matched_user_id
        ? `${row.matched_first_name ?? ""} ${row.matched_last_name ?? ""}`.trim() || row.matched_user_id
        : null,
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

  // Тасдиқ/рад мустақим аз рӯйхат — сатр аз он ҷо нест намешавад, танҳо
  // статусаш иваз мешавад (то дар "таърих" боқӣ монад).
  const reviewAttempt = useCallback(
    async (attemptId: string, approve: boolean) => {
      setReviewingId(attemptId);
      try {
        const token = await getToken({ template: "supabase" });
        if (!token) return;
        const supabase = createClerkSupabaseClient(token);
        const { error } = await supabase.rpc("review_verification_attempt", {
          p_attempt_id: attemptId,
          p_approve: approve,
        });
        if (error) throw error;
        setItems((prev) =>
          prev.map((item) =>
            item.attemptId === attemptId ? { ...item, status: approve ? "passed" : "rejected" } : item,
          ),
        );
        toast.success(approve ? t("verifyApprove") : t("verifyReject"));
      } catch (err: any) {
        toast.error(err.message || t("error"));
      } finally {
        setReviewingId(null);
      }
    },
    [getToken, t],
  );

  const count = items.filter((item) => item.status === "pending_review").length;

  return { items, count, loading, reviewAttempt, reviewingId, refetch: fetchPending };
}
