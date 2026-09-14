/**
 * Next.js's automatic loading UI — when a page inside the (main) group
 * (e.g. during navigation) has server work (a DB fetch) that isn't ready
 * yet, Next.js IMMEDIATELY shows this skeleton (instead of a blank screen)
 * — the Header and MobileNavbar (in layout.tsx) stay unaffected, since
 * loading.tsx only takes the place of {children}. This is the "native app
 * feel" needed for instant transitions between pages.
 *
 * The geometry must be EXACTLY the same as the actual home page — that's
 * why HOME_GRID_CLASS/HOME_CONTENT_PT and the shared skeleton components
 * are used, instead of hand-picked classes.
 */
import { ItemCardSkeleton } from "@/components/item-card-skeleton";
import { HomeFiltersSkeleton } from "@/components/home-filters-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { HOME_GRID_CLASS, HOME_CONTENT_PT } from "@/lib/ui-constants";

// BUG FOUND (user request: "the Taxi row has no skeleton"): this row
// (QUICK_ACTIONS in home-client.tsx) sits not in the fixed bar
// (HomeFiltersSkeleton), but in the SCROLLABLE part of the content —
// so not having a skeleton for it doesn't cause a layout shift
// (no need to change HOME_CONTENT_PT), it just left a meaningless
// empty space until the actual load finished.
const QUICK_ACTION_COUNT = 5;

export default function MainLoading() {
  return (
    <div className="pb-18 min-h-screen bg-canvas">
      <HomeFiltersSkeleton />
      <div className={`w-full max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-5 ${HOME_CONTENT_PT}`}>
        <div className="mb-2.5 flex gap-2.5 overflow-hidden">
          {[...Array(QUICK_ACTION_COUNT)].map((_, i) => (
            <Skeleton
              key={i}
              className="shrink-0 w-[37%] min-[480px]:w-36 min-[1503px]:w-40 min-[1920px]:w-[168px] h-[52px] min-[1503px]:h-14 min-[1920px]:h-[60px] rounded-xl"
            />
          ))}
        </div>
        <div className={HOME_GRID_CLASS}>
          {[...Array(8)].map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
