/**
 * Loading state for the "Important People" carousel — uses the same card
 * size/aspect classes as the real cards so there's no layout jump when real
 * data replaces it. Reuses the shared shadcn Skeleton primitive.
 */
import { Skeleton } from "@/components/ui/skeleton";

// Shared by the carousel's card wrappers, the cards and this skeleton so they
// can't drift. Phones: one card with a peek of the next; sm/lg/xl: 2/3/4 per row.
export const FEATURED_CARD_SIZE =
  "w-[calc(100%-30px)] sm:w-[calc(50%-5px)] lg:w-[calc(33.333%-7px)] xl:w-[calc(25%-8px)]";
export const FEATURED_CARD_ASPECT = "aspect-[2/1] sm:aspect-[16/10]";
// A lone card spans the whole strip, so it gets a wider/shorter ratio from sm
// up (otherwise it would be ~600px tall on a tablet and ~800px on a desktop).
export const FEATURED_SINGLE_CARD_SIZE = "w-full";
export const FEATURED_SINGLE_CARD_ASPECT =
  "aspect-[2/1] sm:aspect-[5/2] lg:aspect-[4/1]";

export function FeaturedPeopleSkeleton() {
  return (
    <div
      className="flex gap-2.5 overflow-x-auto no-scrollbar"
      aria-hidden
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton
          key={i}
          className={`shrink-0 rounded-md ${FEATURED_CARD_SIZE} ${FEATURED_CARD_ASPECT}`}
        />
      ))}
    </div>
  );
}
