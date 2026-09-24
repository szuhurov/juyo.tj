"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Check, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AdminSubscription {
  id: string;
  user_id: string;
  user_name: string | null;
  tier: "vip" | "vvip";
  duration_days: number;
  price_tjs: number | string;
  currency: string;
  status: "pending" | "active" | "expired" | "cancelled" | "revoked";
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

const STATUS_COLORS: Record<AdminSubscription["status"], string> = {
  pending: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-zinc-700/50 dark:text-zinc-300 dark:border-zinc-600",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/50",
  expired: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700",
  cancelled: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700",
  revoked: "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50",
};

// Admin visibility + the only place a subscription actually moves from
// 'pending' to 'active' — the manual stand-in for a real payment webhook
// (no payment provider is integrated this phase; see the migration's
// header comment). Gated by the standard Clerk admin allowlist, same as
// every other /admin/** page.
export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/subscriptions?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubs(data.subscriptions ?? []);
      setCount(data.count ?? 0);
    } catch {
      toast.error("Хатогӣ");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleActivate = async (id: string) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}/activate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Фаъол карда шуд");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Хатогӣ");
    } finally {
      setActingId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    const reason = window.prompt("Сабаб (ихтиёрӣ):") ?? undefined;
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Бекор карда шуд");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Хатогӣ");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            VIP/VVIP обунаҳо
          </h1>
          <p className="text-sm text-zinc-500 mt-1">{count} обуна</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Дар интизор</SelectItem>
              <SelectItem value="active">Фаъол</SelectItem>
              <SelectItem value="expired">Гузашта</SelectItem>
              <SelectItem value="cancelled">Бекоршуда</SelectItem>
              <SelectItem value="revoked">Маҳрумшуда</SelectItem>
              <SelectItem value="all">Ҳама</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : subs.length === 0 ? (
        <p className="text-sm text-zinc-400 py-10 text-center">Обуна нест.</p>
      ) : (
        <div className="space-y-2">
          {subs.map((sub) => (
            <div
              key={sub.id}
              className="rounded-md border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 flex items-center gap-3"
            >
              <div
                className={cn(
                  "shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold border",
                  sub.tier === "vvip" ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50" : "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-600",
                )}
              >
                <Crown className="w-3 h-3" />
                {sub.tier.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  {sub.user_name || sub.user_id}
                </p>
                <p className="text-xs text-zinc-400">
                  {sub.duration_days} рӯз · {sub.price_tjs} {sub.currency} ·{" "}
                  {new Date(sub.created_at).toLocaleDateString("ru-RU")}
                  {sub.expires_at && ` · то ${new Date(sub.expires_at).toLocaleDateString("ru-RU")}`}
                </p>
                {sub.cancel_reason && <p className="text-xs text-red-500 mt-0.5">{sub.cancel_reason}</p>}
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold border", STATUS_COLORS[sub.status])}>
                {sub.status}
              </span>
              {sub.status === "pending" && (
                <Button size="sm" disabled={actingId === sub.id} onClick={() => handleActivate(sub.id)} className="bg-emerald-500 hover:bg-emerald-600">
                  <Check className="w-3.5 h-3.5 mr-1" /> Тасдиқ
                </Button>
              )}
              {sub.status === "active" && (
                <Button size="sm" variant="secondary" disabled={actingId === sub.id} onClick={() => handleRevoke(sub.id)}>
                  <X className="w-3.5 h-3.5 mr-1" /> Бекор
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
