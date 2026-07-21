"use client";

import { useEffect, useState } from "react";
import { PackageSearch, PackageCheck, Clock, CheckCircle2 } from "lucide-react";
import { useAdminPosts } from "@/lib/hooks/use-admin-posts";
import { useAdminStats } from "@/lib/hooks/use-admin-stats";
import type { AdminPostFilters } from "@/lib/services/admin-service";
import { PostFilterBar } from "@/components/admin/posts/post-filter-bar";
import { PostTable } from "@/components/admin/posts/post-table";
import { DeletedPostsArchive } from "@/components/admin/posts/deleted-posts-archive";
import { PaginationBar } from "@/components/admin/pagination-bar";
import { StatCard } from "@/components/admin/stat-card";
import { StatCardGrid } from "@/components/admin/stat-card-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSearch } from "@/lib/admin-search-context";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

const PAGE_SIZE = 20;

export default function AdminPostsPage() {
  const { query } = useAdminSearch();
  const search = useDebouncedValue(query, 250);
  const [filters, setFilters] = useState<AdminPostFilters>({ page: 0, pageSize: PAGE_SIZE });
  const [archiveView, setArchiveView] = useState(false);
  const { data, isLoading, isError, error } = useAdminPosts({ ...filters, search: search || undefined });
  const { data: stats } = useAdminStats();

  useEffect(() => {
    // Бознишонии саҳифа ба 0 ҳангоми иваз шудани ҷустуҷӯ (сигнали берунӣ).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters((f) => ({ ...f, page: 0 }));
  }, [search]);

  return (
    <div className="space-y-4">
      {stats && (
        <StatCardGrid>
          <StatCard icon={PackageSearch} label="Гумшуда" value={stats.totalLostItems} accent="rose" />
          <StatCard icon={PackageCheck} label="Ёфтшуда" value={stats.totalFoundItems} accent="amber" />
          <StatCard icon={Clock} label="Дар навбати тасдиқ" value={stats.pendingModerationCount} accent="sky" />
          <StatCard icon={CheckCircle2} label="Ҳалшуда" value={stats.totalResolvedItems} accent="emerald" />
        </StatCardGrid>
      )}

      <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm space-y-4">
        <PostFilterBar
          filters={filters}
          onChange={setFilters}
          archiveView={archiveView}
          onArchiveViewChange={setArchiveView}
        />

        {archiveView ? (
          <DeletedPostsArchive />
        ) : isError ? (
          <p className="py-16 text-center text-sm font-bold text-rose-500">
            Хатогӣ ҳангоми боркунӣ: {error instanceof Error ? error.message : "номаълум"}
          </p>
        ) : isLoading || !data ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <>
            <PostTable rows={data.posts} />
            <PaginationBar
              page={filters.page ?? 0}
              pageSize={PAGE_SIZE}
              total={data.total}
              onPageChange={(page) => setFilters({ ...filters, page })}
            />
          </>
        )}
      </div>
    </div>
  );
}
