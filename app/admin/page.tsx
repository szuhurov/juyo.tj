"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useUser } from "@clerk/nextjs";
import { Users, Package, CheckCircle2, BellRing } from "lucide-react";
import { useAdminStats, type StatsPeriod } from "@/lib/hooks/use-admin-stats";
import { StatCard } from "@/components/admin/stat-card";
import { AiModerationToggle } from "@/components/admin/ai-moderation-toggle";
import { PostExpiryPanel } from "@/components/admin/post-expiry-panel";
import { ReprocessEmbeddingsButton } from "@/components/admin/reprocess-embeddings-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// recharts is heavy — it gets its own chunk instead of being bundled
// into the main admin bundle.
const DashboardLineChart = dynamic(
  () => import("@/components/admin/dashboard-line-chart").then((m) => m.DashboardLineChart),
  { loading: () => <Skeleton className="h-64 rounded-md" /> },
);
const DashboardCategoryChart = dynamic(
  () => import("@/components/admin/dashboard-category-chart").then((m) => m.DashboardCategoryChart),
  { loading: () => <Skeleton className="h-64 rounded-md" /> },
);

const PERIOD_LABELS: Record<StatsPeriod, string> = {
  today: "Имрӯз",
  week: "Ин ҳафта",
  month: "Ин моҳ",
  year: "Ин сол",
  all: "Ҳамеша",
};

export default function AdminDashboardPage() {
  const { user } = useUser();
  const [period, setPeriod] = useState<StatsPeriod>("all");
  const { data: stats, isLoading } = useAdminStats(period);

  const firstName = user?.firstName || "Admin";

  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  const totalItems = stats.totalLostItems + stats.totalFoundItems;
  const isAllTime = period === "all";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Салом, {firstName}! 👋
          </h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">
            Ин аст вазъи ҷории juyo.tj — {PERIOD_LABELS[period].toLowerCase()}.
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as StatsPeriod)}>
          <SelectTrigger className="w-40 h-10 rounded-full border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 font-medium text-zinc-700 dark:text-zinc-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as StatsPeriod[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PERIOD_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AiModerationToggle />
      <PostExpiryPanel />
      <ReprocessEmbeddingsButton />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label={isAllTime ? "Ҳамагӣ корбарон" : "Корбарони нав"}
          value={stats.totalUsers}
        />
        <StatCard
          icon={Package}
          label={isAllTime ? "Ҳамагӣ эълонҳо" : "Эълонҳои нав"}
          value={totalItems}
          accent="blue"
        />
        <StatCard icon={CheckCircle2} label="Ҳалшуда" value={stats.totalResolvedItems} accent="emerald" />
        <StatCard icon={BellRing} label="Push фаъол" value={stats.totalPushEnabledUsers} accent="sky" />
      </div>

      <div className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Афзоиши корбарон</h3>
          <span className="text-[11px] font-medium text-zinc-400">{PERIOD_LABELS[period]}</span>
        </div>
        <DashboardLineChart data={stats.signupsByDay} granularity={stats.signupsGranularity} />
      </div>

      <div className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Эълонҳо аз рӯи категория</h3>
        </div>
        <DashboardCategoryChart data={stats.itemsByCategory} />
      </div>
    </div>
  );
}
