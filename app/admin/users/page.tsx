"use client";

import { useEffect, useState } from "react";
import { BellRing, Users, UserPlus, CalendarDays, Bell, ChevronDown, Loader2 } from "lucide-react";
import { useAdminUsers } from "@/lib/hooks/use-admin-users";
import { useAdminStats } from "@/lib/hooks/use-admin-stats";
import type { AdminUserFilters } from "@/lib/services/admin-service";
import { UserFilterBar } from "@/components/admin/users/user-filter-bar";
import { UserTable } from "@/components/admin/users/user-table";
import { DeletedAccountsArchive } from "@/components/admin/users/deleted-accounts-archive";
import { StatCard } from "@/components/admin/stat-card";
import { StatCardGrid } from "@/components/admin/stat-card-grid";
import { Button } from "@/components/ui/button";
import { SendNotificationDialog } from "@/components/admin/users/send-notification-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSearch } from "@/lib/admin-search-context";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

const INITIAL_PAGE_SIZE = 20;
const LOAD_MORE_STEP = 100;

export default function AdminUsersPage() {
  const { query } = useAdminSearch();
  const search = useDebouncedValue(query, 250);
  const [filters, setFilters] = useState<AdminUserFilters>({ status: "active", page: 0, pageSize: INITIAL_PAGE_SIZE });
  const [archiveView, setArchiveView] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const { data, isLoading, isFetching, isError, error } = useAdminUsers({ ...filters, search: search || undefined });
  const { data: stats } = useAdminStats();

  useEffect(() => {
    // Бознишонии саҳифа ба 0 ҳангоми иваз шудани ҷустуҷӯ (сигнали берунӣ).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters((f) => ({ ...f, page: 0, pageSize: INITIAL_PAGE_SIZE }));
  }, [search]);

  const handleFilterChange = (next: AdminUserFilters) => {
    setFilters({ ...next, page: 0, pageSize: INITIAL_PAGE_SIZE });
  };

  const loadMore = () => {
    setFilters((f) => ({ ...f, pageSize: (f.pageSize ?? INITIAL_PAGE_SIZE) + LOAD_MORE_STEP }));
  };

  return (
    <div className="space-y-4">
      {stats && (
        <StatCardGrid>
          <StatCard icon={Users} label="Ҳамаи корбарон" value={stats.totalUsers} />
          <StatCard icon={UserPlus} label="Имрӯз пайваст шуданд" value={stats.usersJoinedToday} accent="blue" />
          <StatCard icon={CalendarDays} label="Ин моҳ пайваст шуданд" value={stats.usersJoinedThisMonth} accent="amber" />
          <StatCard icon={Bell} label="Push фаъол доранд" value={stats.totalPushEnabledUsers} accent="sky" />
        </StatCardGrid>
      )}

      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm overflow-hidden">
        <div className="sticky top-0 z-10 bg-white p-4 pb-4 space-y-4 border-b border-zinc-100">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm font-medium text-zinc-400">
              {archiveView ? "Корбарони нестшуда — trash ва пурра нестшуда" : data ? `${data.total} корбар` : "Боркунӣ..."}
            </p>
            {!archiveView && (
              <Button onClick={() => setNotifyOpen(true)} className="gap-2 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 h-10 px-4 shadow-none">
                <BellRing className="w-4 h-4" />
                Хабарнома ба ҳама
              </Button>
            )}
          </div>
          <UserFilterBar
            filters={filters}
            onChange={handleFilterChange}
            archiveView={archiveView}
            onArchiveViewChange={setArchiveView}
          />
        </div>

        <div className="p-4 pt-3">
        {archiveView ? (
          <DeletedAccountsArchive />
        ) : isError ? (
          <p className="py-16 text-center text-sm font-bold text-rose-500">
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
                  className="gap-2 rounded-full border-zinc-100 text-zinc-600 font-bold"
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
