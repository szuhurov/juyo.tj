/**
 * Loading UI-и худкори Next.js — вақте ки саҳифаи дохили гурӯҳи (main)
 * (масалан ҳангоми гузариш) кори сервериаш (DB fetch) ҳанӯз тайёр нест,
 * Next.js ФАВРАН ҳамин skeleton-ро нишон медиҳад (на экрани холӣ) — Header
 * ва MobileNavbar (дар layout.tsx) бетаъсир мемонанд, зеро loading.tsx
 * танҳо ҷои {children}-ро мегирад. Ин ҳамон "ҳисси native app"-ест, ки
 * барои гузариши фаврӣ байни саҳифаҳо лозим аст.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { ITEM_GRID_CLASS } from "@/lib/ui-constants";

export default function MainLoading() {
  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-4 pt-[80px] md:pt-[62px]">
      <div className={ITEM_GRID_CLASS}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
