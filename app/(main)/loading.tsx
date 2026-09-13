/**
 * Loading UI-и худкори Next.js — вақте ки саҳифаи дохили гурӯҳи (main)
 * (масалан ҳангоми гузариш) кори сервериаш (DB fetch) ҳанӯз тайёр нест,
 * Next.js ФАВРАН ҳамин skeleton-ро нишон медиҳад (на экрани холӣ) — Header
 * ва MobileNavbar (дар layout.tsx) бетаъсир мемонанд, зеро loading.tsx
 * танҳо ҷои {children}-ро мегирад. Ин ҳамон "ҳисси native app"-ест, ки
 * барои гузариши фаврӣ байни саҳифаҳо лозим аст.
 *
 * Геометрия бояд бо саҳифаи асосӣ АЙНАН як хел бошад — ҳамин сабаб
 * HOME_GRID_CLASS/HOME_CONTENT_PT ва компонентҳои умумии skeleton
 * истифода мешаванд, на классҳои дастӣ.
 */
import { ItemCardSkeleton } from "@/components/item-card-skeleton";
import { HomeFiltersSkeleton } from "@/components/home-filters-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { HOME_GRID_CLASS, HOME_CONTENT_PT } from "@/lib/ui-constants";

// ХАТОГИИ ЁФТШУДА (талаби корбар: "гурӯҳи Такси skeleton надорад"): ин
// қатор (QUICK_ACTIONS дар home-client.tsx) на дар бари fixed
// (HomeFiltersSkeleton), балки дар ҚИСМИ СКРОЛЛШАВАНДАИ мӯҳтаво
// меистад — пас надоштани skeleton барояш ҷаҳиши тарҳбандӣ намедиҳад
// (HOME_CONTENT_PT-ро тағйир додан лозим нест), танҳо ҷои холии
// бемаъно то боркунии воқеӣ мемонд.
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
