import { Smartphone, Send } from "lucide-react";
import { SOURCE_LABELS } from "@/lib/client-stats";

const SOURCE_ORDER = ["app", "web", "instagram", "telegram", "admin", "unknown"] as const;

/**
 * Dashboard: how many people use the mobile app (Android / iPhone) and where
 * the listings of the chosen period were posted from. Both come from
 * migration 20261013000000_client_stats; until it is applied the API sends
 * null and the panel says so instead of showing zeros.
 */
export function ClientStatsPanel({
  appUsers,
  itemsBySource,
  periodLabel,
}: {
  appUsers: { total: number; android: number; ios: number; newInPeriod: number } | null;
  itemsBySource: Record<string, number> | null;
  periodLabel: string;
}) {
  const card = "min-w-0 rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-4";
  const totalItems = itemsBySource ? Object.values(itemsBySource).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className={card}>
        <div className="flex items-center gap-2 mb-3">
          <Smartphone className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Корбарони барнома</h3>
        </div>
        {appUsers ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Ҳамагӣ", value: appUsers.total },
                { label: "Android", value: appUsers.android },
                { label: "iPhone", value: appUsers.ios },
              ].map((x) => (
                <div key={x.label} className="rounded-md bg-zinc-50 dark:bg-zinc-900/40 p-3">
                  <p className="text-[11px] font-medium text-zinc-500">{x.label}</p>
                  <p className="text-2xl font-semibold text-zinc-900 dark:text-white tabular-nums">{x.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Нав ({periodLabel}): <span className="font-semibold text-zinc-800 dark:text-zinc-200">{appUsers.newInPeriod}</span>. Танҳо
              онҳое ҳисоб мешаванд, ки дар барнома ворид шудаанд (аз версияи 1.0.1). Шумораи умумии насбро Google Play
              Console ва App Store Connect нишон медиҳанд.
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">Ҳанӯз дастрас нест: базаи маълумот навсозӣ нашудааст.</p>
        )}
      </div>

      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Эълонҳо аз куҷо гузошта шуданд</h3>
          </div>
          <span className="text-[11px] font-medium text-zinc-400">{periodLabel}</span>
        </div>
        {itemsBySource ? (
          <div className="space-y-2">
            {SOURCE_ORDER.filter((key) => key !== "unknown" || itemsBySource.unknown).map((key) => {
              const count = itemsBySource[key] ?? 0;
              const share = totalItems ? Math.round((count / totalItems) * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 font-medium text-zinc-600 dark:text-zinc-300">{SOURCE_LABELS[key]}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900/60">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${share}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {count} <span className="text-[11px] font-medium text-zinc-400">{share}%</span>
                  </span>
                </div>
              );
            })}
            {itemsBySource.unknown ? (
              <p className="pt-1 text-xs text-zinc-500">«Номаълум» — эълонҳое, ки пеш аз сабти манбаъ гузошта шудаанд.</p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Ҳанӯз дастрас нест: базаи маълумот навсозӣ нашудааст.</p>
        )}
      </div>
    </div>
  );
}
