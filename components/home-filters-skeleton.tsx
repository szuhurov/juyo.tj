/**
 * Skeleton for the home page filter bar.
 *
 * Why this is needed: `app/(main)/loading.tsx` replaces the entire
 * {children}, meaning that when navigating to the home page the filter
 * bar didn't exist AT ALL and then suddenly "popped in". The geometry
 * (row heights, gaps, padding) must be EXACTLY the same as HomeContent —
 * otherwise HOME_CONTENT_PT becomes wrong and the content jumps.
 */
import { Skeleton } from "@/components/ui/skeleton";

// Approximate widths of the pills — so the bar isn't "empty" and stays
// close to the actual category text.
const CATEGORY_WIDTHS = ["w-16", "w-24", "w-20", "w-24", "w-16", "w-20"];

export function HomeFiltersSkeleton() {
  return (
    <div className="fixed top-12 sm:top-16 left-0 right-0 z-40 bg-canvas">
      <div className="w-full pl-3 sm:pl-4">
        <div className="w-full py-1.5">
          {/* Category row */}
          <div className="flex items-center gap-1.5 overflow-hidden -mx-1 px-1 py-2.5 -my-2.5">
            {CATEGORY_WIDTHS.map((w, i) => (
              <Skeleton
                key={i}
                className={`shrink-0 ${w} h-7 md:h-9 min-[1084px]:h-10 min-[1920px]:h-[42px] rounded-full`}
              />
            ))}
          </div>

          {/* Type row (All / Lost / Found) + date button */}
          <div className="flex items-center gap-1.5 mt-1.5 mb-1.5">
            <Skeleton className="w-16 h-7 md:h-9 min-[1084px]:h-10 min-[1920px]:h-[42px] rounded-full" />
            <Skeleton className="w-24 h-7 md:h-9 min-[1084px]:h-10 min-[1920px]:h-[42px] rounded-full" />
            <Skeleton className="w-24 h-7 md:h-9 min-[1084px]:h-10 min-[1920px]:h-[42px] rounded-full" />
            <Skeleton className="ml-auto mr-2 h-7 w-7 md:h-9 md:w-9 min-[1503px]:h-10 min-[1503px]:w-10 min-[1920px]:h-[42px] min-[1920px]:w-[42px] rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
