"use client";

import { useEffect, useState } from "react";
import { useUrlFilters } from "@/lib/hooks/use-url-filters";
import { BellRing, Users, UserPlus, UserX, CalendarDays, Bell, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminUsers } from "@/lib/hooks/use-admin-users";
import { useAdminStats } from "@/lib/hooks/use-admin-stats";
import type { AdminUserFilters } from "@/lib/services/admin-service";
import { UserTable } from "@/components/admin/users/user-table";
import {
  DeletedAccountsArchive,
  isInDeletedRange,
  useDeletedAccountRows,
  type DeletedRange,
} from "@/components/admin/users/deleted-accounts-archive";
import { StatCard } from "@/components/admin/stat-card";
import { StatCardGrid } from "@/components/admin/stat-card-grid";
import { Button } from "@/components/ui/button";
import { SendNotificationDialog } from "@/components/admin/users/send-notification-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSearch } from "@/lib/admin-search-context";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

const INITIAL_PAGE_SIZE = 20;
const LOAD_MORE_STEP = 100;
const USER_FILTER_KEYS = [
  "status",
  "joined",
  "pushEnabled",
  "sort",
  "order",
  "page",
  "pageSize",
  "archive",
] as const;

export default function AdminUsersPage() {
  const { query } = useAdminSearch();
  const search = useDebouncedValue(query, 250);
  const { filters, setFilters } = useUrlFilters<AdminUserFilters & { archive?: string }>({
    keys: USER_FILTER_KEYS,
    numericKeys: ["page", "pageSize"],
    defaults: { status: "active", page: 0, pageSize: INITIAL_PAGE_SIZE },
  });
  const archiveView = filters.archive === "1";
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  // Fills EMPTY email/name/phone of existing profiles from Clerk (server-side,
  // production key) — never overwrites.
  const syncFromClerk = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/users/sync-from-clerk", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Хатогӣ");
      toast.success(`Аз Clerk пур шуд: ${data.updated} профил (санҷида шуд ${data.checked})`);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Хатогӣ");
    } finally {
      setSyncing(false);
    }
  };
  const { rows: deletedRows } = useDeletedAccountRows();
  const [deletedRange, setDeletedRange] = useState<DeletedRange | undefined>(undefined);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const { data, isLoading, isFetching, isError, error } = useAdminUsers({ ...filters, search: search || undefined });
  const { data: stats } = useAdminStats();

  useEffect(() => {
    // Reset the page to 0 when the search changes (an external signal).
    if (!filters.page && filters.pageSize === INITIAL_PAGE_SIZE) return;
    setFilters({ ...filters, page: 0, pageSize: INITIAL_PAGE_SIZE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // A card toggles its own filter; leaving the "Deleted" view on the way.
  const toggleQuick = (patch: Partial<AdminUserFilters>) => {
    setFilters({ ...filters, archive: undefined, ...patch, page: 0, pageSize: INITIAL_PAGE_SIZE });
  };

  const loadMore = () => {
    setFilters({
      ...filters,
      pageSize: (filters.pageSize ?? INITIAL_PAGE_SIZE) + LOAD_MORE_STEP,
    });
  };

  return (
    <div className="space-y-4">
      {stats && (
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0">
            {archiveView ? (
              // "Deleted" view: the cards count deleted accounts instead; no push card.
              <StatCardGrid cols={3}>
                <StatCard
                  icon={UserX}
                  label="Ҳамаи нестшудаҳо"
                  value={deletedRows.length}
                  accent="rose"
                  active={!deletedRange}
                  onClick={() => setDeletedRange(undefined)}
                />
                <StatCard
                  icon={UserX}
                  label="Имрӯз нест шуданд"
                  value={deletedRows.filter((r) => isInDeletedRange(r.date, "today")).length}
                  accent="rose"
                  active={deletedRange === "today"}
                  onClick={() => setDeletedRange(deletedRange === "today" ? undefined : "today")}
                />
                <StatCard
                  icon={CalendarDays}
                  label="Ин моҳ нест шуданд"
                  value={deletedRows.filter((r) => isInDeletedRange(r.date, "month")).length}
                  accent="amber"
                  active={deletedRange === "month"}
                  onClick={() => setDeletedRange(deletedRange === "month" ? undefined : "month")}
                />
              </StatCardGrid>
            ) : (
              <StatCardGrid>
                <StatCard
                  icon={Users}
                  label="Ҳамаи корбарон"
                  value={stats.totalUsers}
                  active={!archiveView && filters.status === "all" && !filters.joined && !filters.pushEnabled}
                  onClick={() => setFilters({ status: "all", page: 0, pageSize: INITIAL_PAGE_SIZE })}
                />
                <StatCard
                  icon={UserPlus}
                  label="Имрӯз пайваст шуданд"
                  value={stats.usersJoinedToday}
                  accent="blue"
                  active={!archiveView && filters.joined === "today"}
                  onClick={() => toggleQuick({ joined: filters.joined === "today" ? undefined : "today" })}
                />
                <StatCard
                  icon={CalendarDays}
                  label="Ин моҳ пайваст шуданд"
                  value={stats.usersJoinedThisMonth}
                  accent="amber"
                  active={!archiveView && filters.joined === "month"}
                  onClick={() => toggleQuick({ joined: filters.joined === "month" ? undefined : "month" })}
                />
                <StatCard
                  icon={Bell}
                  label="Push фаъол доранд"
                  value={stats.totalPushEnabledUsers}
                  accent="sky"
                  active={!archiveView && filters.pushEnabled === "1"}
                  onClick={() => toggleQuick({ pushEnabled: filters.pushEnabled === "1" ? undefined : "1" })}
                />
              </StatCardGrid>
            )}
          </div>
          {/* The only filters the cards don't already cover. */}
          <div className="flex lg:flex-col gap-2 lg:w-44">
            {([
              { key: "active", label: "Фаъол", on: !archiveView && (filters.status ?? "active") === "active" },
              { key: "deleted", label: "Нестшудаҳо", on: archiveView },
            ] as const).map((b) => (
              <button
                key={b.key}
                type="button"
                aria-pressed={b.on}
                onClick={() =>
                  b.key === "deleted"
                    ? setFilters({ ...filters, archive: "1", page: 0 })
                    : setFilters({ status: "active", page: 0, pageSize: INITIAL_PAGE_SIZE })
                }
                className={cn(
                  "flex-1 h-12 lg:h-auto rounded-md border px-4 text-sm font-semibold transition-colors",
                  b.on
                    ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700",
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 overflow-hidden">
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-800 p-4 pb-4 space-y-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm font-medium text-zinc-400">
              {archiveView ? "Корбарони нестшуда — trash ва пурра нестшуда" : data ? `${data.total} корбар` : "Боркунӣ..."}
            </p>
            {!archiveView && (
              <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={syncFromClerk}
                disabled={syncing}
                className="gap-2 rounded-md h-10 px-4 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Email/ном аз Clerk
              </Button>
              <Button onClick={() => setNotifyOpen(true)} className="gap-2 rounded-md bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 text-blue-600 dark:text-blue-400 border border-blue-100 h-10 px-4 shadow-none">
                <BellRing className="w-4 h-4" />
                Хабарнома ба ҳама
              </Button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 pt-3">
        {archiveView ? (
          <DeletedAccountsArchive range={deletedRange} />
        ) : isError ? (
          <p className="py-16 text-center text-sm font-semibold text-rose-500 dark:text-rose-400">
            Хатогӣ ҳангоми боркунӣ: {error instanceof Error ? error.message : "номаълум"}
          </p>
        ) : isLoading || !data ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <UserTable rows={data.users} />
            {data.users.length < data.total && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={isFetching}
                  className="gap-2 rounded-full border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
                >
                  {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                  Бештар нишон диҳед ({data.total - data.users.length} боқӣ)
                </Button>
              </div>
            )}
          </>
        )}
        </div>
      </div>

      <SendNotificationDialog
        open={notifyOpen}
        onOpenChange={setNotifyOpen}
        target={{ mode: "all" }}
        targetLabel="ҳамаи корбарон"
      />
    </div>
  );
}
