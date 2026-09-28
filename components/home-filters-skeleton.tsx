/**
 * Loading placeholders for the Home filter bar and the place-tiles row. They
 * mirror the CURRENT layout in app/(main)/home-client.tsx (and the mobile
 * app's FeedSkeletons.tsx), so nothing jumps when the real bar renders:
 *
 *   row 1 — All / Found / Lost pills (rounded-md) + search field (flex-1)
 *           + the square filter button on the right
 *   row 2 — category tiles (5.5 per screen on mobile, fixed widths from md):
 *           square icon at 76% width + one-line label
 *   QuickActionsSkeleton — the place tiles (title/desc column + emoji)
 */
import { Skeleton } from "@/components/ui/skeleton";

const CONTROL_H = "h-7 md:h-9 min-[1084px]:h-10 min-[1920px]:h-[42px]";
const TYPE_WIDTHS = ["w-12 md:w-14", "w-20 md:w-24", "w-20 md:w-24"];
const CATEGORY_COUNT = 9;

export function HomeFiltersSkeleton() {
  return (
    <div className="fixed top-12 sm:top-16 left-0 right-0 z-40 bg-canvas" aria-hidden>
      <div className="w-full max-w-7xl mx-auto pl-2.5 sm:pl-4">
        <div className="w-full pt-0.5 pb-1.5">
          <div className="flex items-center gap-1.5">
            {TYPE_WIDTHS.map((w, i) => (
              <Skeleton key={i} className={`shrink-0 ${w} ${CONTROL_H} rounded-md`} />
            ))}
            <Skeleton className={`flex-1 min-w-[120px] ${CONTROL_H} rounded-md`} />
            <Skeleton className="ml-auto mr-2 shrink-0 h-9 w-9 min-[1503px]:h-10 min-[1503px]:w-10 min-[1920px]:h-[42px] min-[1920px]:w-[42px] rounded-md" />
          </div>

          <div className="mt-0.5 flex items-start gap-1 overflow-hidden py-2.5 -my-2.5">
            {Array.from({ length: CATEGORY_COUNT }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 flex flex-col items-center w-[calc((100vw-20px)/5.5)] md:w-20 min-[1503px]:w-24"
              >
                <Skeleton className="w-[76%] md:w-full aspect-square rounded-md" />
                <Skeleton className="mt-1 h-2.5 w-3/5 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const QUICK_ACTION_WIDTHS = ["w-24", "w-28", "w-32", "w-28", "w-32", "w-28"];

/** The place tiles row — same padding/height as the real buttons
 *  (px-3 py-1.5, the place icon next to a title + description column). */
export function QuickActionsSkeleton() {
  return (
    <div className="mb-2.5 flex gap-1.5 overflow-hidden mr-[-10px] sm:mr-[-16px] lg:mr-[-20px]" aria-hidden>
      {QUICK_ACTION_WIDTHS.map((w, i) => (
        <Skeleton
          key={i}
          className={`shrink-0 ${w} h-[45px] min-[1503px]:h-[58px] min-[1920px]:h-[60px] rounded-md`}
        />
      ))}
    </div>
  );
}
