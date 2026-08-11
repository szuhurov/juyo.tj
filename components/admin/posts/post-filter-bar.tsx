"use client";

import { cn } from "@/lib/utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/services/item-service";
import type { AdminPostFilters } from "@/lib/services/admin-service";

export function PostFilterBar({
  filters,
  onChange,
  archiveView,
  onArchiveViewChange,
}: {
  filters: AdminPostFilters;
  onChange: (filters: AdminPostFilters) => void;
  archiveView: boolean;
  onArchiveViewChange: (archiveView: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-8">
        <button
          type="button"
          onClick={() => {
            onArchiveViewChange(false);
            onChange({ ...filters, status: "active", page: 0 });
          }}
          className={cn(
            "text-sm font-bold pb-1 border-b-2 transition-colors",
            !archiveView
              ? "text-zinc-900 dark:text-white border-blue-600"
              : "text-zinc-400 border-transparent hover:text-zinc-600",
          )}
        >
          Ҳама эълонҳо
        </button>
        <button
          type="button"
          onClick={() => onArchiveViewChange(true)}
          className={cn(
            "text-sm font-bold pb-1 border-b-2 transition-colors",
            archiveView
              ? "text-zinc-900 dark:text-white border-blue-600"
              : "text-zinc-400 border-transparent hover:text-zinc-600",
          )}
        >
          Нестшудаҳо
        </button>
      </div>

      {!archiveView && (
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={filters.type ?? "all"}
            onValueChange={(v) => onChange({ ...filters, type: v === "all" ? undefined : (v as AdminPostFilters["type"]), page: 0 })}
          >
            <SelectTrigger className="w-40 h-11 rounded-2xl border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 focus:ring-blue-500/30">
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
            <SelectTrigger className="w-44 h-11 rounded-2xl border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 focus:ring-blue-500/30">
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
            <SelectTrigger className="w-44 h-11 rounded-2xl border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 focus:ring-blue-500/30">
              <SelectValue placeholder="Ҳолати тасдиқ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ҳама ҳолат</SelectItem>
              <SelectItem value="pending">Дар интизор</SelectItem>
              <SelectItem value="approved">Тасдиқшуда</SelectItem>
              <SelectItem value="rejected">Рад шуда</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.resolved ?? "all"}
            onValueChange={(v) => onChange({ ...filters, resolved: v as AdminPostFilters["resolved"], page: 0 })}
          >
            <SelectTrigger className="w-36 h-11 rounded-2xl border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 focus:ring-blue-500/30">
              <SelectValue placeholder="Ҳал" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ҳама</SelectItem>
              <SelectItem value="true">Ҳалшуда</SelectItem>
              <SelectItem value="false">Ҳалнашуда</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filters.dateFrom ?? ""}
              max={filters.dateTo ?? undefined}
              onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined, page: 0 })}
              className="h-11 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <span className="text-xs font-bold text-zinc-400">то</span>
            <input
              type="date"
              value={filters.dateTo ?? ""}
              min={filters.dateFrom ?? undefined}
              onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined, page: 0 })}
              className="h-11 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            {(filters.dateFrom || filters.dateTo) && (
              <button
                type="button"
                onClick={() => onChange({ ...filters, dateFrom: undefined, dateTo: undefined, page: 0 })}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-600 px-1"
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
