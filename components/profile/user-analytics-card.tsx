"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { AnalyticsService, type UserAnalyticsSummary } from "@/lib/services/analytics-service";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Phase 9C — a lightweight stats strip on the existing "My posts" tab, not
 * a separate dashboard page (explicit scope decision: a single user's
 * activity volume doesn't justify a dedicated screen). Strictly the
 * caller's own data — get_my_analytics_summary derives scope from
 * get_auth_id(), never from a client-supplied user id.
 */
export function UserAnalyticsCard() {
  const { t } = useLanguage();
  const { getToken, userId, isLoaded } = useAuth();
  const [data, setData] = useState<UserAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const supabase = createClerkSupabaseClient(getToken);
    AnalyticsService.getMyAnalyticsSummary(30, supabase)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isLoaded, userId, getToken]);

  if (!isLoaded || !userId) return null;

  if (loading) {
    return <Skeleton className="h-20 w-full rounded-md mb-4" />;
  }
  if (!data || data.totalPosts === 0) return null;

  const items: { label: string; value: number }[] = [
    { label: t("userAnalyticsTotalPosts"), value: data.totalPosts },
    { label: t("userAnalyticsActive"), value: data.activePosts },
    { label: t("userAnalyticsResolved"), value: data.resolvedPosts },
    { label: t("userAnalyticsMatches"), value: data.matchesReceived },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-md border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 text-center">
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{it.value}</p>
          <p className="text-[10px] font-medium text-zinc-400 mt-0.5 leading-tight">{it.label}</p>
        </div>
      ))}
    </div>
  );
}
