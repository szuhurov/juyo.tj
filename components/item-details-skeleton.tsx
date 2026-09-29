/**
 * Loading placeholder for /items/[id] — mirrors the CURRENT layout of
 * item-details-client.tsx (and the mobile app's item screen skeleton):
 *
 *   image   — full-width square (h-[100vw] on mobile, aspect-square from md)
 *   sheet   — rounded-t-3xl -mt-8 px-5 pt-10 on mobile, plain column from md:
 *             handle, user row (avatar + name/surname, views on the right),
 *             title + type badge in ONE row, "Description" label + text lines,
 *             the flex-1 action buttons, the full-width contact button.
 *
 * Used by both the route's loading.tsx and the client component's own
 * "query still running" branch, so the two can never drift apart again.
 */
import { Skeleton } from "@/components/ui/skeleton";

const ACTION_H = "h-12 md:h-16 min-[1084px]:h-[70px] min-[1920px]:h-20";
const CONTACT_H = "h-14 md:h-16 min-[1084px]:h-[70px] min-[1920px]:h-20";

export function ItemDetailsSkeleton() {
  return (
    <div
      aria-hidden
      className="min-h-screen bg-canvas mx-auto max-w-6xl md:pt-8 md:px-4 -mb-20 pb-20 md:mb-0 md:pb-0"
    >
      {/* Desktop back button row (h-10 + mb-3), see item-details-client. */}
      <div className="hidden md:flex items-center h-10 mb-3">
        <Skeleton className="h-4 w-24 rounded" />
      </div>
      <div className="flex flex-col md:grid md:grid-cols-2 gap-0 md:gap-12 md:items-start relative">
        <div className="w-full h-[100vw] md:h-auto md:aspect-square">
          <Skeleton className="w-full h-full rounded-none md:rounded-md" />
        </div>

        <div className="flex flex-col relative z-10 bg-canvas rounded-t-3xl md:rounded-none -mt-8 md:mt-0 px-5 pt-10 md:px-0 md:pt-0 pb-12">
          <div className="md:hidden flex justify-center -mt-6 mb-4">
            <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700" />
          </div>

          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 min-[1084px]:w-14 min-[1084px]:h-14 min-[1920px]:w-16 min-[1920px]:h-16 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            </div>
            <Skeleton className="mr-3 h-3.5 w-10 rounded" />
          </div>

          <div className="flex items-center justify-between gap-3 mb-3">
            <Skeleton className="h-6 min-[1503px]:h-[30px] w-3/5 rounded" />
            <Skeleton className="h-7 w-20 shrink-0 rounded-md" />
          </div>

          <div className="mb-5">
            <Skeleton className="mb-3.5 h-4 w-24 rounded" />
            {["w-full", "w-[94%]", "w-2/3"].map((w) => (
              <div key={w} className="flex h-[26px] min-[1084px]:h-[29px] min-[1503px]:h-[32.5px] items-center">
                <Skeleton className={`h-3.5 ${w} rounded`} />
              </div>
            ))}
          </div>

          <div className="flex flex-row items-center gap-2 mb-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={`flex-1 ${ACTION_H} rounded-md`} />
            ))}
          </div>

          <Skeleton className={`w-full ${CONTACT_H} rounded-md`} />
        </div>
      </div>
    </div>
  );
}
