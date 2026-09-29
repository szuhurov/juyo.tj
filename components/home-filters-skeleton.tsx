/**
 * Loading placeholders for the Home filter bar and the place-tiles row. They
 * mirror the CURRENT layout in app/(main)/home-client.tsx (and the mobile
 * app's FeedSkeletons.tsx), so nothing jumps when the real bar renders:
 *
 *   row 1 — All / Found / Lost pills (rounded-md) + search field (flex-1)
 *           + the square filter button on the right
 *   row 2 — category tiles (5.5 per screen on mobile, fixed widths from md):
 *           square icon at 76% width (no label placeholder — owner request)
 *   QuickActionsSkeleton — the place tiles (title/desc lines + icon, no fill:
 *           the real tiles have no background)
 */
import { Skeleton } from "@/components/ui/skeleton";

const CONTROL_H = "h-9 min-[1084px]:h-10 min-[1920px]:h-[42px]";
const TYPE_WIDTHS = ["w-12 md:w-14", "w-20 md:w-24", "w-20 md:w-24"];
const CATEGORY_COUNT = 9;

export function HomeFiltersSkeleton() {
  return (
    // In normal flow (not fixed like the real bar): whatever follows — the
    // place-tiles skeleton — then sits right under it at every breakpoint,
    // instead of depending on a guessed top padding (it hid under the
    // category row on desktop).
    <div className="bg-canvas" aria-hidden>
      <div className="w-full max-w-7xl mx-auto pl-2.5 sm:pl-4">
        <div className="w-full pt-2.5 md:pt-0.5 pb-1.5">
          {/* Same order as the real bar: phones = search, filter, bell / three type buttons. */}
          <div className="flex flex-wrap items-center gap-1.5 max-md:gap-y-2">
            {TYPE_WIDTHS.map((w, i) => (
              <Skeleton key={i} className={`shrink-0 ${w} ${CONTROL_H} rounded-md max-md:order-5 max-md:flex-1 max-md:basis-0 ${i === 2 ? "max-md:mr-2.5" : ""}`} />
            ))}
            <Skeleton className={`flex-1 min-w-[120px] ${CONTROL_H} rounded-md max-md:order-1`} />
            <Skeleton className="order-3 md:hidden mr-2.5 shrink-0 h-9 w-9 rounded-md" />
            <div aria-hidden className="order-4 basis-full h-0 md:hidden" />
            <Skeleton className="ml-auto mr-2 max-md:order-2 max-md:ml-0 max-md:mr-0 shrink-0 h-9 w-9 min-[1503px]:h-10 min-[1503px]:w-10 min-[1920px]:h-[42px] min-[1920px]:w-[42px] rounded-md" />
          </div>

          <div className="mt-0.5 flex items-start gap-1 overflow-hidden py-2.5 -my-2.5">
            {Array.from({ length: CATEGORY_COUNT }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 flex flex-col items-center w-[calc((100vw-20px)/5.5)] md:w-20 min-[1503px]:w-24 lg:flex-1"
              >
                <Skeleton className="w-[76%] md:w-full lg:max-w-[72px] aspect-square rounded-md" />
                {/* Room for the real label (not drawn — owner request). */}
                <div className="h-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const QUICK_ACTION_WIDTHS = ["w-14", "w-16", "w-20", "w-16", "w-20", "w-16", "w-14"];

/** The place tiles row — same padding/height as the real buttons
 *  (px-3 py-1.5, the place icon next to a title + description column). */
export function QuickActionsSkeleton() {
  return (
    <div className="mb-2.5 flex gap-1.5 overflow-hidden mr-[-10px] sm:mr-[-16px] lg:mr-[-20px]" aria-hidden>
      {QUICK_ACTION_WIDTHS.map((w, i) => (
        <div key={i} className="shrink-0 flex items-center gap-3 px-3 py-1.5 min-[1503px]:py-2.5">
          <div className="flex flex-col gap-1.5">
            <Skeleton className={`h-3 ${w} rounded`} />
            <Skeleton className="h-2.5 w-20 rounded" />
          </div>
          <Skeleton className="w-[30px] h-[30px] min-[1503px]:w-8 min-[1503px]:h-8 min-[1920px]:w-9 min-[1920px]:h-9 rounded-md" />
        </div>
      ))}
    </div>
  );
}
