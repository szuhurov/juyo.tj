/**
 * Skeleton for a listing card. Its GEOMETRY must match the real card, or the
 * content "jumps" (layout shift) when the data arrives:
 *
 *   feed    → ItemFeedCard (home): 16:10 image, no left padding (pr-3 pt-1 pb-1),
 *             title+date, one description line (-mt-0.5), then the type label
 *             with the size-6/7 arrow circle (mt-0.5 mb-0.5).
 *   profile → ItemCard (profile): white card, no shadow (like the app), 4:3 image,
 *             px-3.5 pt-1.5 pb-2, description mt-0.5, then the rounded
 *             canvas pill (mt-1 -mx-1 p-0.5 pl-3) with the size-7/8 circle.
 *
 * Row heights follow the text line-boxes: text-sm/base → h-5/6,
 * text-[11px]/xs → 16.5px/16px. Blocks use the app-style `.juyo-skeleton`
 * (globals.css). If either card changes, change this too.
 */
import { cn } from "@/lib/utils";

const BLOCK = "juyo-skeleton";

export function ItemCardSkeleton({
  variant = "feed",
}: {
  variant?: "feed" | "profile";
}) {
  if (variant === "profile") {
    return (
      <div
        aria-hidden
        className="flex flex-col gap-0 rounded-md bg-white dark:bg-zinc-800 overflow-hidden"
      >
        <div className={cn("aspect-[4/3] w-full rounded-md", BLOCK)} />
        <div className="px-3.5 pt-1.5 pb-2 flex flex-col flex-1">
          <div className="flex h-5 min-[1084px]:h-6 items-center justify-between gap-2">
            <div className={cn("h-3.5 min-[1084px]:h-4 w-2/3 rounded", BLOCK)} />
            <div className={cn("h-3 w-12 shrink-0 rounded", BLOCK)} />
          </div>
          <div className="mt-0.5 flex h-[16.5px] min-[1084px]:h-4 items-center">
            <div className={cn("h-2.5 w-4/5 rounded", BLOCK)} />
          </div>
          <div className="mt-1 -mx-1 flex items-center justify-between gap-2 rounded-full bg-canvas p-0.5 pl-3">
            <div className={cn("h-3 w-16 rounded", BLOCK)} />
            <div className={cn("size-7 min-[1084px]:size-8 shrink-0 rounded-full", BLOCK)} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div aria-hidden className="flex flex-col gap-0 rounded-md overflow-hidden">
      <div className={cn("aspect-[16/10] w-full rounded-md", BLOCK)} />
      <div className="pr-3 pt-1 pb-1 flex flex-col flex-1">
        <div className="flex h-5 min-[1084px]:h-6 items-center justify-between gap-2">
          <div className={cn("h-3.5 min-[1084px]:h-4 w-2/3 rounded", BLOCK)} />
          <div className={cn("h-3 w-12 shrink-0 rounded", BLOCK)} />
        </div>
        <div className="-mt-0.5 flex h-[16.5px] min-[1084px]:h-4 items-center">
          <div className={cn("h-2.5 w-4/5 rounded", BLOCK)} />
        </div>
        <div className="mt-0.5 mb-0.5 flex items-center justify-between gap-2">
          <div className={cn("h-3 w-14 rounded", BLOCK)} />
          <div className={cn("size-6 min-[1084px]:size-7 shrink-0 rounded-full", BLOCK)} />
        </div>
      </div>
    </div>
  );
}
