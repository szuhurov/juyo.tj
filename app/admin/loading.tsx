/**
 * Loading UI-и худкори admin — Sidebar/Topbar (дар layout.tsx) бетаъсир
 * мемонанд, танҳо мӯҳтавои саҳифа skeleton нишон медиҳад — ниг.
 * app/(main)/loading.tsx барои шарҳи пурра.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
