"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bot, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AdminMatchItem {
  id: string;
  title: string | null;
  user_id: string;
  type: "lost" | "found";
  moderation_status: string;
  is_resolved: boolean;
  status: string | null;
}

interface AdminMatch {
  id: string;
  score: number;
  reasons: string[];
  created_at: string;
  lost: AdminMatchItem | null;
  found: AdminMatchItem | null;
}

// Admin-only visibility into Phase 5 matches — scores, reasons, both
// items, and (via the linked item) each poster's id, but never a phone
// number or private field: this page reads the exact same admin API route
// (app/api/admin/matches) that uses supabaseAdmin, and item_matches itself
// has RLS enabled with zero client policies, so this is the only privileged
// read path, same shape as every other admin list page.
export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/matches?pageSize=50");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMatches(data.matches ?? []);
      setCount(data.count ?? 0);
    } catch {
      toast.error("Хатогӣ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const res = await fetch("/api/admin/matches/reprocess", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Санҷида шуд: ${data.scanned} эълон`);
      load();
    } catch {
      toast.error("Хатогӣ");
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Bot className="w-5 h-5 text-violet-500" />
            Мутобиқатҳои AI
          </h1>
          <p className="text-sm text-zinc-500 mt-1">{count} мутобиқат</p>
        </div>
        <Button onClick={handleReprocess} disabled={reprocessing} variant="secondary">
          <RefreshCw className={cn("w-4 h-4 mr-2", reprocessing && "animate-spin")} />
          Backfill
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <p className="text-sm text-zinc-400 py-10 text-center">Ҳоло мутобиқат нест.</p>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => {
            const liveEligible = (item: AdminMatchItem | null) =>
              !!item && item.moderation_status === "approved" && !item.is_resolved && item.status !== "deleted";
            const stale = !liveEligible(m.lost) || !liveEligible(m.found);
            return (
              <div
                key={m.id}
                className={cn(
                  "rounded-md border p-4 bg-white dark:bg-zinc-800",
                  stale ? "border-amber-300 dark:border-amber-900/60" : "border-hairline dark:border-zinc-700",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-900/20 px-2.5 py-1 text-xs font-bold text-violet-600 dark:text-violet-400">
                    {Math.round(Number(m.score))}%
                  </span>
                  {stale && (
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-500">
                      Дигар зинда нест (нест шуд / ҳал шуд / рад шуд)
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-400">{new Date(m.created_at).toLocaleString("ru-RU")}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase text-zinc-400 font-semibold">Гумшуда</p>
                    <Link href={`/admin/posts/${m.lost?.id}`} className="text-emerald-600 hover:underline flex items-center gap-1">
                      {m.lost?.title ?? "—"} <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-zinc-400 font-semibold">Ёфтшуда</p>
                    <Link href={`/admin/posts/${m.found?.id}`} className="text-emerald-600 hover:underline flex items-center gap-1">
                      {m.found?.title ?? "—"} <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {m.reasons.map((r) => (
                    <span key={r} className="text-[9px] rounded-full bg-slate-50 dark:bg-zinc-700/50 border border-hairline dark:border-zinc-700 px-2 py-0.5 text-slate-500 dark:text-zinc-400">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
