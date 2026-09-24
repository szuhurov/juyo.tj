/**
 * Skeleton for a listing card. Its GEOMETRY must be EXACTLY the same as
 * ItemFeedCard/ItemCard — the same rounded, the same aspect-[4/3], the
 * same padding, and the same row heights. Otherwise the content "jumps"
 * (layout shift) when the data arrives, which is exactly what the
 * skeleton is supposed to prevent.
 *
 * NEVER WHITE. The container used to be `bg-slate-100` (#f4f4f5), which
 * looked practically white against the canvas background. Now the whole
 * card is one gray shade: the base is lighter, the blocks are darker —
 * so it looks like a "ghost" of a card, not an empty white card.
 *
 * `variant`: feed → home page (rounded-md, px-3),
 *            profile → ItemCard in profile (rounded-md, px-3.5).
 */
import { cn } from "@/lib/utils";

/** Inner blocks are one shade darker than the card's base surface —
 *  otherwise they'd blend into one color and the card's shape would be
 *  unreadable. */
const BLOCK = "animate-pulse bg-slate-300/80 dark:bg-zinc-700";

export function ItemCardSkeleton({
  variant = "feed",
}: {
  variant?: "feed" | "profile";
}) {
  const feed = variant === "feed";
  const radius = feed ? "rounded-md" : "rounded-md";

  return (
    <div
      className={cn(
        "flex flex-col gap-0 overflow-hidden bg-slate-200/70 dark:bg-zinc-800",
        radius,
      )}
    >
      {/* Image — in the real card it's rounded on all FOUR sides, not just the top */}
      <div className={cn("aspect-[4/3] w-full", radius, BLOCK)} />

      {/* Padding and spacing exactly match ItemFeedCard: pt-1.5 / mt-0.5 / pb-1.5.
          The height of EVERY row is also tied to the actual text's line-box —
          measured, not guessed:

            title row     20px → 24px from min-[1084px]  (text-sm → text-base)
            description   16.5px → 16px                  (text-[11px] → text-xs)
            button        32px → 36px                    (p-0.5 + size-7 → size-8)

          Total: 88.5px on mobile, 96px at min-[1084px] — exactly like the card.
          If these numbers drift apart, the layout jumps when the data
          arrives, which is exactly what the skeleton is meant to prevent. */}
      <div className={cn("flex flex-1 flex-col pt-1.5 pb-1.5", feed ? "px-3" : "px-3.5")}>
        {/* Title row + date */}
        <div className="flex h-5 min-[1084px]:h-6 items-center justify-between gap-2">
          <div className={cn("h-3.5 min-[1084px]:h-4 w-2/3 rounded", BLOCK)} />
          <div className={cn("h-3 w-12 shrink-0 rounded", BLOCK)} />
        </div>

        {/* Description — ONE line (the card also has `truncate`, not two lines) */}
        <div className="flex h-[16.5px] min-[1084px]:h-4 items-center">
          <div className={cn("h-2.5 w-4/5 rounded", BLOCK)} />
        </div>

        {/* Type button — ONE solid bar. The dot indicator is deliberately
            OMITTED: in the skeleton it would need its own green background
            and would look like an element that's already "ready", while
            the card is still loading. */}
        <div className={cn("mt-0.5 -mx-1 h-7 min-[1084px]:h-8 rounded-full", BLOCK)} />
      </div>
    </div>
  );
}
