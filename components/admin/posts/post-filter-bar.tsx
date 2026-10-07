"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/services/item-service";
import type { AdminPostFilters } from "@/lib/services/admin-service";

type TabKey = "all" | "resolved" | "unresolved" | "pending" | "deleted";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "Ҳама эълонҳо" },
  { key: "resolved", label: "Ҳалшуда" },
  { key: "unresolved", label: "Ҳалнашуда" },
  { key: "pending", label: "Дар интизорӣ" },
  { key: "deleted", label: "Нестшудаҳо" },
];

function activeTab(filters: AdminPostFilters): TabKey {
  if (filters.moderation_status === "pending") return "pending";
  if (filters.resolved === "true") return "resolved";
  if (filters.resolved === "false") return "unresolved";
  return "all";
}

export function PostFilterBar({
  filters,
  onChange,
  archiveView,
  onArchiveViewChange,
}: {
  filters: AdminPostFilters & { archive?: string };
  onChange: (filters: AdminPostFilters & { archive?: string }) => void;
  archiveView: boolean;
  onArchiveViewChange: (archiveView: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      {/* One row of views (the old "Ҳал" dropdown moved in here). They share
          the filter state with the stat cards and the dropdowns below. */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
        {TABS.map((tab) => {
          const on = tab.key === "deleted" ? archiveView : !archiveView && activeTab(filters) === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={on}
              onClick={() => {
                if (tab.key === "deleted") {
                  onArchiveViewChange(true);
                  return;
                }
                // One update (archive off + the view's filters): two separate
                // updates raced and the second put the old archive flag back.
                onChange({
                  ...filters,
                  archive: undefined,
                  status: "active",
                  resolved: tab.key === "resolved" ? "true" : tab.key === "unresolved" ? "false" : undefined,
                  moderation_status: tab.key === "pending" ? "pending" : filters.moderation_status === "pending" ? undefined : filters.moderation_status,
                  page: 0,
                });
              }}
              className={cn(
                "text-sm font-semibold pb-1 border-b-2 transition-colors",
                on ? "text-zinc-900 dark:text-white border-blue-600" : "text-zinc-400 border-transparent hover:text-zinc-600",
              )}
            >
              {tab.label}
            </button>
          );
        })}
        <Link
          href="/admin/posts/safe"
          className="text-sm font-semibold pb-1 border-b-2 border-transparent text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
        >
          Бехатар (AI)
        </Link>
      </div>

      {!archiveView && (
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={filters.type ?? "all"}
            onValueChange={(v) => onChange({ ...filters, type: v === "all" ? undefined : (v as AdminPostFilters["type"]), page: 0 })}
          >
            <SelectTrigger className="w-40 h-11 rounded-md border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 focus:ring-blue-500/30">
              <SelectValue placeholder="Намуд" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ҳама намуд</SelectItem>
              <SelectItem value="lost">Гумшуда</SelectItem>
              <SelectItem value="found">Ёфтшуда</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.category ?? "all"}
            onValueChange={(v) => onChange({ ...filters, category: v === "all" ? undefined : v, page: 0 })}
          >
            <SelectTrigger className="w-44 h-11 rounded-md border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 focus:ring-blue-500/30">
              <SelectValue placeholder="Категория" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ҳама категория</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.icon} {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.moderation_status ?? "all"}
            onValueChange={(v) =>
              onChange({ ...filters, moderation_status: v === "all" ? undefined : (v as AdminPostFilters["moderation_status"]), page: 0 })
            }
          >
            <SelectTrigger className="w-44 h-11 rounded-md border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 focus:ring-blue-500/30">
              <SelectValue placeholder="Ҳолати тасдиқ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ҳама ҳолат</SelectItem>
              <SelectItem value="pending">Дар интизор</SelectItem>
              <SelectItem value="approved">Тасдиқшуда</SelectItem>
              <SelectItem value="rejected">Рад шуда</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filters.dateFrom ?? ""}
              max={filters.dateTo ?? undefined}
              onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined, page: 0 })}
              className="h-11 rounded-md border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <span className="text-xs font-medium text-zinc-400">то</span>
            <input
              type="date"
              value={filters.dateTo ?? ""}
              min={filters.dateFrom ?? undefined}
              onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined, page: 0 })}
              className="h-11 rounded-md border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            {(filters.dateFrom || filters.dateTo) && (
              <button
                type="button"
                onClick={() => onChange({ ...filters, dateFrom: undefined, dateTo: undefined, page: 0 })}
                className="text-xs font-medium text-zinc-400 hover:text-zinc-600 px-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
