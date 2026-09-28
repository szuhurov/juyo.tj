/**
 * Loading rows for /notifications — geometry of NotificationRow in
 * app/(main)/notifications/page.tsx: py-3 row, avatar 44/48/56px, title line
 * with the small type badge, one notice/date line (mt-1), chevron on the
 * right; rows sit in `space-y-1`. Used by both the page and its loading.tsx.
 */
import { Skeleton } from "@/components/ui/skeleton";

export function NotificationRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-1" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="py-3 flex items-center gap-3">
          <Skeleton className="w-11 h-11 min-[1084px]:w-12 min-[1084px]:h-12 min-[1920px]:w-14 min-[1920px]:h-14 rounded-full shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex h-5 min-[1084px]:h-6 items-center gap-2">
              <Skeleton className="h-3.5 min-[1084px]:h-4 w-3/5 rounded" />
              <Skeleton className="h-4 w-12 rounded-full shrink-0" />
            </div>
            <div className="mt-1 flex h-[15px] min-[1084px]:h-[16.5px] items-center">
              <Skeleton className="h-2.5 w-24 rounded" />
            </div>
          </div>
          <Skeleton className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1920px]:w-5 min-[1920px]:h-5 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Route-level fallback: the page header strip + the rows. */
export function NotificationsPageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-2.5 sm:px-4 py-6 sm:py-8" aria-hidden>
      <div className="py-3 mb-4 flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800">
        <Skeleton className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 rounded shrink-0" />
        <Skeleton className="h-4 min-[1084px]:h-5 w-32 rounded" />
      </div>
      <NotificationRowsSkeleton />
    </div>
  );
}
