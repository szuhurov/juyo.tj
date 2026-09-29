"use client";

/**
 * Port of the app's components/UserAnalyticsCard.tsx: three pill tiles
 * (Active / Resolved / Matches) that also act as the "My posts" filter.
 * Active/Resolved come from the same `items` array the list shows (one source
 * of truth); only "matches" needs the RPC. Strictly the caller's own data —
 * get_my_analytics_summary derives scope from get_auth_id().
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { AnalyticsService } from "@/lib/services/analytics-service";
import type { Item } from "@/lib/services/item-service";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type PostsFilter = "active" | "resolved" | "matches";

export function UserAnalyticsCard({
  items,
  itemsLoading,
  selectedFilter,
  onSelectFilter,
}: {
  items: Item[];
  itemsLoading: boolean;
  selectedFilter: PostsFilter;
  onSelectFilter: (filter: PostsFilter) => void;
}) {
  const { t } = useLanguage();
  const { getToken, userId, isLoaded } = useAuth();

  const { data, isLoading: matchesLoading } = useQuery({
    queryKey: ["user-analytics-summary", userId],
    queryFn: () => AnalyticsService.getMyAnalyticsSummary(30, createClerkSupabaseClient(getToken)),
    enabled: isLoaded && !!userId,
    staleTime: 30000,
  });

  if (!isLoaded || !userId) return null;
  if (itemsLoading || matchesLoading) {
    return (
      <div className="flex gap-1.5 mb-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-9 flex-1 rounded-lg" />
        ))}
      </div>
    );
  }
  if (items.length === 0) return null;

  const resolvedCount = items.filter((i) => i.is_resolved).length;
  const tiles: { key: PostsFilter; label: string; value: number }[] = [
    { key: "active", label: t("userAnalyticsActive"), value: items.length - resolvedCount },
    { key: "resolved", label: t("userAnalyticsResolved"), value: resolvedCount },
    { key: "matches", label: t("userAnalyticsMatches"), value: data?.matchesReceived ?? 0 },
  ];

  return (
    <div className="flex gap-1.5 mb-3">
      {tiles.map((it) => {
        const active = it.key === selectedFilter;
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSelectFilter(it.key)}
            className={cn(
              "flex-1 min-w-0 flex items-baseline justify-center gap-1 rounded-lg px-2.5 py-1.5 transition-colors",
              active ? "bg-emerald-500" : "bg-tile hover:bg-zinc-200/60 dark:hover:bg-zinc-700",
            )}
          >
            <span className={cn("text-base font-semibold tabular-nums", active ? "text-white" : "text-zinc-800 dark:text-zinc-100")}>
              {it.value}
            </span>
            <span className={cn("truncate text-xs font-medium", active ? "text-white/80" : "text-zinc-500 dark:text-zinc-400")}>
              {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
