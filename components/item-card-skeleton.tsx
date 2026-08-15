/**
 * Skeleton-и корти эълон. ГЕОМЕТРИЯИ он бояд бо ItemFeedCard/ItemCard
 * АЙНАН як хел бошад — ҳамон rounded, ҳамон aspect-[4/3], ҳамон padding
 * ва ҳамон баландии сатрҳо. Вагарна ҳангоми омадани маълумот мӯҳтаво
 * "меҷаҳад" (layout shift), ки маҳз ҳамон чизест, ки skeleton бояд
 * пешгирӣ кунад.
 *
 * САФЕД ҲАРГИЗ. Пештар контейнер `bg-zinc-100` (#f4f4f5) буд, ки дар
 * заминаи canvas амалан сафед менамуд. Ҳоло тамоми корт як сояи хокистарӣ
 * аст: сатҳ равшантар, блокҳо торектар — то он «шабаҳи» корт бошад, на
 * корти сафеди холӣ.
 *
 * `variant`: feed → саҳифаи асосӣ (rounded-lg, px-3),
 *            profile → ItemCard дар профил (rounded-xl, px-3.5).
 */
import { cn } from "@/lib/utils";

/** Блокҳои дохилӣ аз сатҳи корт як зина торектаранд — вагарна дар як ранг
 *  ғарқ мешуданд ва шакли корт хонда намешуд. */
const BLOCK = "animate-pulse bg-zinc-300/80 dark:bg-zinc-700";

export function ItemCardSkeleton({
  variant = "feed",
}: {
  variant?: "feed" | "profile";
}) {
  const feed = variant === "feed";
  const radius = feed ? "rounded-lg" : "rounded-xl";

  return (
    <div
      className={cn(
        "flex flex-col gap-0 overflow-hidden bg-zinc-200/70 dark:bg-zinc-800",
        radius,
      )}
    >
      {/* Акс — дар корти воқеӣ аз ҳар ЧОР тараф мудаввар аст, на танҳо аз боло */}
      <div className={cn("aspect-[4/3] w-full", radius, BLOCK)} />

      {/* Падингҳо ва фосилаҳо айнан аз ItemFeedCard: pt-1.5 / mt-0.5 / pb-1.5.
          Баландии ҲАР сатр низ ба line-box-и воқеии матн баста шудааст —
          ченкардашуда, на тахминӣ:

            сатри унвон  20px → 24px аз min-[1084px]  (text-sm → text-base)
            тавсиф       16.5px → 16px               (text-[11px] → text-xs)
            тугма        32px → 36px                 (p-0.5 + size-7 → size-8)

          Ҷамъ: 88.5px дар мобилӣ, 96px дар min-[1084px] — айнан мисли корт.
          Агар ин рақамҳо аз ҳам ҷудо шаванд, ҳангоми омадани маълумот
          тарҳбандӣ меҷаҳад, ки маҳз ҳамон чизест, ки skeleton пешгирӣ мекунад. */}
      <div className={cn("flex flex-1 flex-col pt-1.5 pb-1.5", feed ? "px-3" : "px-3.5")}>
        {/* Сатри унвон + сана */}
        <div className="flex h-5 min-[1084px]:h-6 items-center justify-between gap-2">
          <div className={cn("h-3.5 min-[1084px]:h-4 w-2/3 rounded", BLOCK)} />
          <div className={cn("h-3 w-12 shrink-0 rounded", BLOCK)} />
        </div>

        {/* Тавсиф — ЯК сатр (корт низ `truncate` дорад, на ду сатр) */}
        <div className="flex h-[16.5px] min-[1084px]:h-4 items-center">
          <div className={cn("h-2.5 w-4/5 rounded", BLOCK)} />
        </div>

        {/* Тугмаи навъ — ЯК навори яклухт. Доираи тир қасдан НЕСТ: он дар
            skeleton заминаи сабзи худро талаб мекунад ва ҳамчун унсури
            аллакай "тайёр" ба назар мерасид, дар ҳоле ки корт ҳанӯз бор мешавад. */}
        <div className={cn("mt-0.5 -mx-1 h-7 min-[1084px]:h-8 rounded-full", BLOCK)} />
      </div>
    </div>
  );
}
