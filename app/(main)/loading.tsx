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
import { HomeFiltersSkeleton, QuickActionsSkeleton } from "@/components/home-filters-skeleton";
import { HOME_GRID_CLASS } from "@/lib/ui-constants";

// BUG FOUND (user request: "the Taxi row has no skeleton"): this row
// (QUICK_ACTIONS in home-client.tsx) sits not in the fixed bar
// (HomeFiltersSkeleton), but in the SCROLLABLE part of the content —
// so not having a skeleton for it doesn't cause a layout shift
// (no need to change HOME_CONTENT_PT), it just left a meaningless
// empty space until the actual load finished.
export default function MainLoading() {
  return (
    <div className="pb-18 min-h-screen bg-canvas">
      <HomeFiltersSkeleton />
      <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-5">
        <QuickActionsSkeleton />
        <div className={HOME_GRID_CLASS}>
          {[...Array(8)].map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
