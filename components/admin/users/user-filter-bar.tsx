"use client";

import { cn } from "@/lib/utils";
import type { AdminUserFilters } from "@/lib/services/admin-service";

const TABS: { value: NonNullable<AdminUserFilters["status"]>; label: string }[] = [
  { value: "all", label: "Ҳама корбарон" },
  { value: "active", label: "Фаъол" },
];

const QUICK_FILTERS: { key: "joinedToday" | "joinedMonth" | "pushEnabled"; label: string }[] = [
  { key: "joinedToday", label: "Имрӯз пайваст шуданд" },
  { key: "joinedMonth", label: "Ин моҳ пайваст шуданд" },
  { key: "pushEnabled", label: "Push фаъол доранд" },
];

export function UserFilterBar({
  filters,
  onChange,
  archiveView,
  onArchiveViewChange,
}: {
  filters: AdminUserFilters;
  onChange: (filters: AdminUserFilters) => void;
  archiveView: boolean;
  onArchiveViewChange: (archiveView: boolean) => void;
}) {
  const activeStatus = filters.status ?? "active";

  const toggleQuickFilter = (key: (typeof QUICK_FILTERS)[number]["key"]) => {
    if (key === "pushEnabled") {
      onChange({ ...filters, pushEnabled: filters.pushEnabled === "1" ? undefined : "1", page: 0 });
      return;
    }
    const wantJoined = key === "joinedToday" ? "today" : "month";
    onChange({ ...filters, joined: filters.joined === wantJoined ? undefined : wantJoined, page: 0 });
  };

  const isQuickFilterActive = (key: (typeof QUICK_FILTERS)[number]["key"]) => {
    if (key === "pushEnabled") return filters.pushEnabled === "1";
    if (key === "joinedToday") return filters.joined === "today";
    return filters.joined === "month";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-8">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              onArchiveViewChange(false);
              onChange({ ...filters, status: tab.value, page: 0 });
            }}
            className={cn(
              "text-sm font-semibold pb-1 border-b-2 transition-colors",
              !archiveView && activeStatus === tab.value
                ? "text-zinc-900 dark:text-white border-blue-600"
                : "text-zinc-400 border-transparent hover:text-zinc-600",
            )}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onArchiveViewChange(true)}
          className={cn(
            "text-sm font-semibold pb-1 border-b-2 transition-colors",
            archiveView
              ? "text-zinc-900 dark:text-white border-blue-600"
              : "text-zinc-400 border-transparent hover:text-zinc-600",
          )}
        >
          Нестшудаҳо
        </button>
      </div>

      {!archiveView && (
        <div className="flex items-center gap-2 flex-wrap">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => toggleQuickFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                isQuickFilterActive(f.key)
                  ? "bg-blue-50 dark:bg-blue-500/10 border-blue-100 text-blue-600 dark:text-blue-400"
                  : "bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
