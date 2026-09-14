"use client";

import { useEffect } from "react";
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
import { useUrlFilters } from "@/lib/hooks/use-url-filters";

const PAGE_SIZE = 20;
const POST_FILTER_KEYS = [
  "type",
  "category",
  "moderation_status",
  "resolved",
  "status",
  "dateFrom",
  "dateTo",
  "page",
  "archive",
] as const;

export default function AdminPostsPage() {
  const { query } = useAdminSearch();
  const search = useDebouncedValue(query, 250);
  const { filters, setFilters } = useUrlFilters<AdminPostFilters & { archive?: string }>({
    keys: POST_FILTER_KEYS,
    numericKeys: ["page"],
    defaults: { page: 0, pageSize: PAGE_SIZE },
  });
  const archiveView = filters.archive === "1";
  const { data, isLoading, isError, error } = useAdminPosts({ ...filters, search: search || undefined });
  const { data: stats } = useAdminStats();

  useEffect(() => {
    // Reset the page to 0 when the search changes (an external signal).
    if (!filters.page) return;
    setFilters({ ...filters, page: 0 });
    // We only react to `search` — adding `filters` here would create a
    // loop, since setFilters itself changes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-4 space-y-4">
        <PostFilterBar
          filters={filters}
          onChange={setFilters}
          archiveView={archiveView}
          onArchiveViewChange={(next) =>
            setFilters({ ...filters, archive: next ? "1" : undefined, page: 0 })
          }
        />

        {archiveView ? (
          <DeletedPostsArchive />
        ) : isError ? (
          <p className="py-16 text-center text-sm font-bold text-rose-500 dark:text-rose-400">
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
