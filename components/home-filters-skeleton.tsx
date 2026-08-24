/**
 * Skeleton-и навори филтрҳои саҳифаи асосӣ.
 *
 * Барои чӣ лозим: `app/(main)/loading.tsx` тамоми {children}-ро иваз
 * мекунад, яъне ҳангоми гузариш ба саҳифаи асосӣ навори филтр УМУМАН
 * вуҷуд надошт ва баъд якбора "мепарид". Геометрия (баландии сатрҳо,
 * gap-ҳо, падингҳо) бо HomeContent АЙНАН як хел аст — вагарна
 * HOME_CONTENT_PT нодуруст мешавад ва мӯҳтаво меҷаҳад.
 */
import { Skeleton } from "@/components/ui/skeleton";

// Паҳноии тахминии pill-ҳо — то навор "холӣ" набошад ва ба матни
// воқеии категорияҳо наздик бошад.
const CATEGORY_WIDTHS = ["w-16", "w-24", "w-20", "w-24", "w-16", "w-20"];

export function HomeFiltersSkeleton() {
  return (
    <div className="fixed top-12 sm:top-16 left-0 right-0 z-40 bg-canvas">
      <div className="w-full pl-3 sm:pl-4">
        <div className="w-full py-1.5">
          {/* Қатори категорияҳо */}
          <div className="flex items-center gap-1.5 overflow-hidden -mx-1 px-1 py-2.5 -my-2.5">
            {CATEGORY_WIDTHS.map((w, i) => (
              <Skeleton
                key={i}
                className={`shrink-0 ${w} h-7 md:h-9 min-[1084px]:h-10 min-[1920px]:h-[42px] rounded-full`}
              />
            ))}
          </div>

          {/* Қатори навъ (Ҳама / Гумшуда / Ёфтшуда) + тугмаи сана */}
          <div className="flex items-center gap-1.5 mt-1.5 mb-1.5">
            <Skeleton className="w-16 h-7 md:h-9 min-[1084px]:h-10 min-[1920px]:h-[42px] rounded-full" />
            <Skeleton className="w-24 h-7 md:h-9 min-[1084px]:h-10 min-[1920px]:h-[42px] rounded-full" />
            <Skeleton className="w-24 h-7 md:h-9 min-[1084px]:h-10 min-[1920px]:h-[42px] rounded-full" />
            <Skeleton className="ml-auto mr-2 h-7 w-7 md:h-9 md:w-9 min-[1503px]:h-10 min-[1503px]:w-10 min-[1920px]:h-[42px] min-[1920px]:w-[42px] rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
