"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Users, Package, CheckCircle2, Bot, Building2, CreditCard, Download,
} from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const DashboardCategoryChart = dynamic(
  () => import("@/components/admin/dashboard-category-chart").then((m) => m.DashboardCategoryChart),
  { loading: () => <Skeleton className="h-64 rounded-md" /> },
);

/**
 * Platform admin analytics — Phase 9D. Internal admin tool: matches the
 * rest of /admin (hardcoded Tajik, no tg/ru/en switching) — the existing
 * admin panel is Tajik-only by established convention (admin-sidebar.tsx,
 * every other /admin/** page), not a Phase 9 deviation from the site's
 * i18n rules, which apply to user-facing screens.
 */

const DAY_OPTIONS = [7, 30, 90] as const;

interface AdminAnalytics {
  totalUsers: number;
  newUsers: number;
  totalPosts: number;
  lostPosts: number;
  foundPosts: number;
  activePosts: number;
  resolvedPosts: number;
  pendingModeration: number;
  approvedModeration: number;
  rejectedModeration: number;
  expiredPosts: number;
  deletedPosts: number;
  itemsByCity: { city: string; count: number }[];
  itemsByCategory: { category: string; count: number }[];
  totalMatches: number;
  matchesLow: number;
  matchesMid: number;
  matchesHigh: number;
  organizationFoundMatches: number;
  totalOrganizations: number;
  pendingOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  archivedOrganizations: number;
  totalBranches: number;
  totalStaff: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  subscriptionsByPlan: Record<string, number>;
  subscriptionsByStatus: Record<string, number>;
  pushVolumeByKind: Record<string, number>;
  notificationReads: number;
  notificationDismissals: number;
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30);
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/admin/analytics?days=${days}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const handleExport = () => {
    window.open(`/api/admin/analytics?days=${days}&format=csv`, "_blank");
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Аналитикаи платформа</h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">Омори умумии juyo.tj</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as (typeof DAY_OPTIONS)[number])}>
            <SelectTrigger className="w-32 h-10 rounded-full border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 font-medium text-zinc-700 dark:text-zinc-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} рӯз</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Корбарони нав" value={data.newUsers} hint={`Ҳамагӣ: ${data.totalUsers}`} />
        <StatCard icon={Package} label="Эълонҳои нав" value={data.totalPosts} accent="blue" hint={`LOST ${data.lostPosts} · FOUND ${data.foundPosts}`} />
        <StatCard icon={CheckCircle2} label="Ҳалшуда" value={data.resolvedPosts} accent="emerald" />
        <StatCard icon={Bot} label="Мутобиқатҳои AI" value={data.totalMatches} accent="sky" hint={`80-100: ${data.matchesHigh}`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Созмонҳои фаъол" value={data.activeOrganizations} accent="amber" hint={`Дар интизор: ${data.pendingOrganizations}`} />
        <StatCard icon={Building2} label="Филиалҳо" value={data.totalBranches} accent="amber" hint={`Кормандон: ${data.totalStaff}`} />
        <StatCard icon={CreditCard} label="Обунаҳои B2B фаъол" value={data.activeSubscriptions} accent="rose" hint={`Ҳамагӣ: ${data.totalSubscriptions}`} />
        <StatCard icon={Package} label="Эълонҳои муҳлаташон гузашта" value={data.expiredPosts} hint={`Нест шуда: ${data.deletedPosts}`} />
      </div>

      <div className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Эълонҳо аз рӯи категория</h3>
        <DashboardCategoryChart data={data.itemsByCategory} />
      </div>

      <div className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Эълонҳо аз рӯи шаҳр</h3>
        <div className="space-y-1.5">
          {data.itemsByCity.slice(0, 10).map((c) => (
            <div key={c.city} className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">{c.city}</span>
              <span className="text-zinc-700 dark:text-zinc-200 font-semibold">{c.count}</span>
            </div>
          ))}
          {data.itemsByCity.length === 0 && <p className="text-xs text-zinc-400">Маълумот нест</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Модератсия</h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-zinc-400">Дар интизор</span><span className="font-semibold">{data.pendingModeration}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Тасдиқшуда</span><span className="font-semibold">{data.approvedModeration}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Рад шуда</span><span className="font-semibold">{data.rejectedModeration}</span></div>
          </div>
        </div>
        <div className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Огоҳиномаҳо (push)</h3>
          <div className="space-y-1.5 text-xs">
            {Object.entries(data.pushVolumeByKind).map(([kind, count]) => (
              <div key={kind} className="flex justify-between"><span className="text-zinc-400">{kind}</span><span className="font-semibold">{count}</span></div>
            ))}
            <div className="flex justify-between pt-1 border-t border-zinc-100 dark:border-zinc-700"><span className="text-zinc-400">Хонда шуда</span><span className="font-semibold">{data.notificationReads}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Нодида гирифта шуда</span><span className="font-semibold">{data.notificationDismissals}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
