/**
 * Organization analytics dashboard — Phase 9B/9C. Org-wide roles
 * (owner/admin) see organization-wide data and may drill into one branch;
 * branch-scoped roles (branch_manager/staff/viewer) are locked to their
 * own assigned branch server-side (get_organization_analytics_summary
 * re-derives this from organization_members, never trusts a client
 * branchId for "whose data to show"). Free-tier orgs (no basic_analytics
 * entitlement) see only the three baseline counts plus an upgrade notice.
 */
"use client";

import { use, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language-context";
import { createClerkSupabaseClient } from "@/lib/supabase";
import {
  AnalyticsService, type OrganizationAnalyticsSummary,
} from "@/lib/services/analytics-service";
import { OrganizationService, type MyOrganization } from "@/lib/services/organization-service";
import { OrganizationItemService, type OrganizationBranchOption } from "@/lib/services/organization-item-service";
import { flattenAnalyticsForCsv, toCsv } from "@/lib/analytics-csv";
import { cityLabel } from "@/lib/cities";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Building2, ArrowLeft, Download, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

const DashboardLineChart = dynamic(
  () => import("@/components/admin/dashboard-line-chart").then((m) => m.DashboardLineChart),
  { loading: () => <Skeleton className="h-56 rounded-md" /> },
);
const DashboardCategoryChart = dynamic(
  () => import("@/components/admin/dashboard-category-chart").then((m) => m.DashboardCategoryChart),
  { loading: () => <Skeleton className="h-56 rounded-md" /> },
);

export default function OrganizationAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: organizationId } = use(params);
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { getToken, userId, isLoaded } = useAuth();

  const [mine, setMine] = useState<MyOrganization | null>(null);
  const [branches, setBranches] = useState<OrganizationBranchOption[]>([]);
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<OrganizationAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClerkSupabaseClient(getToken);
      const orgs = await OrganizationService.getMyOrganizations(supabase);
      const found = orgs.find((o) => o.organizationId === organizationId) ?? null;
      setMine(found);
      if (found && ["owner", "admin"].includes(found.role)) {
        const b = await OrganizationItemService.getOrganizationBranchesForPicker(organizationId, undefined, supabase);
        setBranches(b);
      }
      const summary = await AnalyticsService.getOrganizationAnalyticsSummary(organizationId, branchId, days, supabase);
      setData(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId, getToken, branchId, days, t]);

  useEffect(() => {
    if (isLoaded) load();
  }, [isLoaded, load]);

  const isOrgWide = mine && ["owner", "admin"].includes(mine.role);
  const maxDays = data?.entitlement.maxDays ?? 0;

  const handleExport = async () => {
    if (!data?.entitlement.canExport) return;
    try {
      const supabase = createClerkSupabaseClient(getToken);
      await AnalyticsService.recordAuditEvent("export_generated", "organization", organizationId, { days, branchId }, supabase);
      const rows = flattenAnalyticsForCsv(data as unknown as Record<string, unknown>);
      const csv = toCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `juyo-org-analytics-${days}d.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("error"));
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-2.5 sm:px-4 py-6 sm:py-8 space-y-4">
      <div className="sticky top-0 z-30 bg-canvas py-3 mb-1 flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800">
        <button type="button" onClick={() => router.back()} className="shrink-0">
          <ArrowLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
        </button>
        <Building2 className="w-5 h-5 text-sky-500 shrink-0" />
        <h1 className="flex-1 text-base font-bold tracking-tight text-slate-500 dark:text-zinc-400 ml-1">
          {t("orgAnalyticsTitle")}
        </h1>
      </div>

      {loading || !isLoaded ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-md" />)}</div>
      ) : error || !data ? (
        <p className="py-20 text-center text-sm font-medium text-red-500">{error ?? t("error")}</p>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {data.entitlement.basicAnalytics && (
                <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                  <SelectTrigger className="w-32 h-9 rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[7, 30, 90].filter((d) => d <= maxDays || d === 7).map((d) => (
                      <SelectItem key={d} value={String(d)} disabled={d > maxDays}>{d} {t("days")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {isOrgWide && data.entitlement.branchDetailAllowed && branches.length > 0 && (
                <Select value={branchId ?? "__all__"} onValueChange={(v) => setBranchId(v === "__all__" ? undefined : v)}>
                  <SelectTrigger className="w-40 h-9 rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t("orgAnalyticsAllBranches")}</SelectItem>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            {data.entitlement.canExport && (
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> CSV
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard label={t("orgAnalyticsTotalPosts")} value={data.totalPosts} />
            <KpiCard label={t("lost")} value={data.lostPosts} />
            <KpiCard label={t("found")} value={data.foundPosts} />
          </div>

          {!data.entitlement.basicAnalytics ? (
            <div className="rounded-md border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 text-center space-y-2">
              <Lock className="w-6 h-6 mx-auto text-zinc-400" />
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{t("orgAnalyticsUpgradeTitle")}</p>
              <p className="text-xs text-zinc-400">{t("orgAnalyticsUpgradeDesc")}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <KpiCard label={t("orgOwnedPostBadge")} value={data.organizationOwnedFoundPosts ?? 0} />
                <KpiCard label={t("orgAnalyticsAssociatedPosts")} value={data.organizationAssociatedPosts ?? 0} />
                <KpiCard label={t("orgAnalyticsActiveItems")} value={data.activeItems ?? 0} />
                <KpiCard label={t("orgAnalyticsResolvedItems")} value={data.resolvedItems ?? 0} />
                <KpiCard label={t("orgAnalyticsExpiredItems")} value={data.expiredItems ?? 0} />
                <KpiCard label={t("orgAnalyticsAiMatches")} value={data.aiMatches ?? 0} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <KpiCard label={t("orgReviewApprove")} value={data.approvedReviews ?? 0} accent="emerald" />
                <KpiCard label={t("orgAnalyticsPendingReviews")} value={data.pendingReviews ?? 0} accent="amber" />
                <KpiCard label={t("orgReviewReject")} value={data.rejectedReviews ?? 0} accent="rose" />
              </div>

              {data.activityTrend && data.activityTrend.length > 0 && (
                <div className="rounded-md border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{t("orgAnalyticsActivityTrend")}</h3>
                  <DashboardLineChart data={data.activityTrend.map((p) => ({ date: p.day, count: p.count }))} granularity="day" />
                </div>
              )}

              {data.itemsByCategory && data.itemsByCategory.length > 0 && (
                <div className="rounded-md border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{t("orgAnalyticsByCategory")}</h3>
                  <DashboardCategoryChart data={data.itemsByCategory} />
                </div>
              )}

              {data.itemsByCity && data.itemsByCity.length > 0 && (
                <div className="rounded-md border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{t("orgAnalyticsByCity")}</h3>
                  <div className="space-y-1.5">
                    {data.itemsByCity.map((c) => (
                      <div key={c.city} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">{cityLabel(c.city, locale)}</span>
                        <span className="text-zinc-700 dark:text-zinc-200 font-semibold">{c.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.itemsByBranch && data.itemsByBranch.length > 0 && (
                <div className="rounded-md border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{t("orgAnalyticsByBranch")}</h3>
                  <div className="space-y-1.5">
                    {data.itemsByBranch.map((b) => (
                      <div key={b.branchId} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">{b.branchName}</span>
                        <span className="text-zinc-700 dark:text-zinc-200 font-semibold">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!data.entitlement.advancedAnalytics && (
                <p className="text-xs text-zinc-400 text-center">{t("orgAnalyticsAdvancedUpsell")}</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: "emerald" | "amber" | "rose" }) {
  const accentClass = accent === "emerald" ? "text-emerald-600 dark:text-emerald-400"
    : accent === "amber" ? "text-amber-600 dark:text-amber-400"
    : accent === "rose" ? "text-rose-600 dark:text-rose-400"
    : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="rounded-md border border-hairline dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3.5">
      <p className="text-[11px] font-medium text-zinc-400 truncate">{label}</p>
      <p className={`text-xl font-bold tracking-tight mt-1 ${accentClass}`}>{value}</p>
    </div>
  );
}
