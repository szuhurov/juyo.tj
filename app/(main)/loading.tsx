/**
 * Loading UI-и худкори Next.js — вақте ки саҳифаи дохили гурӯҳи (main)
 * (масалан ҳангоми гузариш) кори сервериаш (DB fetch) ҳанӯз тайёр нест,
 * Next.js ФАВРАН ҳамин skeleton-ро нишон медиҳад (на экрани холӣ) — Header
 * ва MobileNavbar (дар layout.tsx) бетаъсир мемонанд, зеро loading.tsx
 * танҳо ҷои {children}-ро мегирад. Ин ҳамон "ҳисси native app"-ест, ки
 * барои гузариши фаврӣ байни саҳифаҳо лозим аст.
 *
 * Геометрия бояд бо саҳифаи асосӣ АЙНАН як хел бошад — ҳамин сабаб
 * HOME_GRID_CLASS/HOME_CONTENT_PT ва ItemCardSkeleton истифода мешаванд,
 * на классҳои дастӣ.
 */
import { ItemCardSkeleton } from "@/components/item-card-skeleton";
import { HOME_GRID_CLASS, HOME_CONTENT_PT } from "@/lib/ui-constants";

export default function MainLoading() {
  return (
    <div className={`w-full px-3 sm:px-4 min-[1084px]:px-5 ${HOME_CONTENT_PT}`}>
      <div className={HOME_GRID_CLASS}>
        {[...Array(8)].map((_, i) => (
          <ItemCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
