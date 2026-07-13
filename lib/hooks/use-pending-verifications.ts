"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { toast } from "sonner";

const POLL_MS = 20_000;

export interface PendingVerification {
  attemptId: string;
  itemId: string;
  itemTitle: string;
  createdAt: string;
}

export function usePendingVerifications() {
  const { userId, getToken } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef<Set<string> | null>(null);

  const fetchPending = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const token = await getToken({ template: "supabase" });
    if (!token) return;
    const supabase = createClerkSupabaseClient(token);
    const { data } = await supabase
      .from("item_verification_attempts")
      .select("id, item_id, created_at, items(title)")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false });

    const rows: PendingVerification[] = (data ?? []).map((row: any) => ({
      attemptId: row.id,
      itemId: row.item_id,
      itemTitle: row.items?.title ?? "",
      createdAt: row.created_at,
    }));

    // Пас аз бори аввал, ҳар savol-и nav-ро бо toast огоҳ мекунем.
    if (seenIds.current) {
      const fresh = rows.filter((r) => !seenIds.current!.has(r.attemptId));
      for (const r of fresh) {
        toast.info(t("verifyNewAttemptToast").replace("%{title}", r.itemTitle));
      }
    }
    seenIds.current = new Set(rows.map((r) => r.attemptId));

    setItems(rows);
    setLoading(false);
  }, [userId, getToken, t]);

  useEffect(() => {
    fetchPending();
    if (!userId) return;
    const interval = setInterval(fetchPending, POLL_MS);
    return () => clearInterval(interval);
  }, [userId, fetchPending]);

  return { items, count: items.length, loading, refetch: fetchPending };
}
