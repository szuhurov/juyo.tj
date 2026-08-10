/**
 * Skeleton-и корти эълон. ГЕОМЕТРИЯИ он бояд бо ItemFeedCard/ItemCard
 * АЙНАН як хел бошад — ҳамон rounded, ҳамон aspect-[4/3], ҳамон padding
 * ва ҳамон баландии сатрҳо. Вагарна ҳангоми омадани маълумот мӯҳтаво
 * "меҷаҳад" (layout shift), ки маҳз ҳамон чизест, ки skeleton бояд
 * пешгирӣ кунад.
 *
 * `variant`: feed → саҳифаи асосӣ (rounded-[1.125rem], px-3),
 *            profile → ItemCard дар профил (rounded-3xl, px-3.5).
 */
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ItemCardSkeleton({
  variant = "feed",
}: {
  variant?: "feed" | "profile";
}) {
  const feed = variant === "feed";

  return (
    <div
      className={cn(
        "flex flex-col gap-0 bg-white dark:bg-zinc-900 overflow-hidden",
        feed ? "rounded-[1.125rem]" : "rounded-3xl",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_5px_12px_-4px_rgba(15,23,42,0.07),0_12px_24px_-14px_rgba(15,23,42,0.09)] dark:shadow-none",
      )}
    >
      {/* Акс — ҳамон aspect ва ҳамон мудаввари болоӣ */}
      <Skeleton
        className={cn(
          "aspect-[4/3] w-full -mb-px rounded-none",
          feed ? "rounded-t-[1.125rem]" : "rounded-t-3xl",
        )}
      />

      <div className={cn("flex flex-col flex-1 pt-2 pb-3", feed ? "px-3" : "px-3.5")}>
        {/* Сатри унвон + сана */}
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 min-[1084px]:h-[18px] w-2/3 rounded" />
          <Skeleton className="h-3 min-[1084px]:h-3.5 w-14 shrink-0 rounded" />
        </div>

        {/* Тавсиф (2 сатр) + доираи тир — ҳамон min-h, то корт нахезад */}
        <div className="relative mt-auto min-h-7 min-[1084px]:min-h-8 pt-1.5">
          <Skeleton className="h-2.5 min-[1084px]:h-3 w-full rounded" />
          <Skeleton className="mt-1.5 h-2.5 min-[1084px]:h-3 w-1/2 rounded" />
          <Skeleton className="absolute bottom-0 right-0 w-7 h-7 min-[1084px]:w-8 min-[1084px]:h-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}
