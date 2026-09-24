"use client";

import { useState } from "react";
import { useAdminPosts } from "@/lib/hooks/use-admin-posts";
import type { AdminPostFilters } from "@/lib/services/admin-service";
import { PostFilterBar } from "@/components/admin/posts/post-filter-bar";
import { PostTable } from "@/components/admin/posts/post-table";
import { DeletedPostsArchive } from "@/components/admin/posts/deleted-posts-archive";
import { PaginationBar } from "@/components/admin/pagination-bar";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 20;

/**
 * The same posts filter/table used in /admin/posts (type, category,
 * moderation status, resolved, Active/Deleted), but scoped to a SINGLE
 * user — user_id is always fixed, the other filters remain free.
 */
export function UserPostsPanel({ userId }: { userId: string }) {
  const [filters, setFilters] = useState<AdminPostFilters>({
    user_id: userId,
    page: 0,
    pageSize: PAGE_SIZE,
  });
  const [archiveView, setArchiveView] = useState(false);
  const { data, isLoading, isError, error } = useAdminPosts(filters);

  return (
    <div className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-4 space-y-4">
      <PostFilterBar
        filters={filters}
        onChange={setFilters}
        archiveView={archiveView}
        onArchiveViewChange={setArchiveView}
      />

      {archiveView ? (
        <DeletedPostsArchive userId={userId} />
      ) : isError ? (
        <p className="py-16 text-center text-sm font-semibold text-rose-500 dark:text-rose-400">
          Хатогӣ ҳангоми боркунӣ: {error instanceof Error ? error.message : "номаълум"}
        </p>
      ) : isLoading || !data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
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
  );
}
