/**
 * Automatic admin loading UI — the Sidebar/Topbar (in layout.tsx) stay
 * unaffected; only the page content shows a skeleton — see
 * app/(main)/loading.tsx for the full explanation.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 rounded-md" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-md" />
    </div>
  );
}
