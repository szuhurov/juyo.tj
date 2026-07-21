/**
 * Grid-и якхелаи корти эълонҳо (ItemCard) — дар ҳама ҷое ки рӯйхати
 * эълонҳо grid-и cards нишон медиҳад истифода мешавад (home, profile
 * posts/saved, my-posts), то тарҳбандӣ дар ҳама ҷо як хел бошад.
 *
 * auto-fill + minmax() ба ҷои шумораи собити сутунҳо (масалан
 * "md:grid-cols-4") интихоб шудааст: шумораи сутунҳо худкор мутобиқи
 * фазои воқеии дастрас зиёд/кам мешавад — на "ҷаҳиш"-и якбора дар як
 * breakpoint (масалан аз 2 сутун ба 4 якбора), балки афзоиши мулоим.
 * Ҳадди поёнӣ (minmax min) дар ҳар tier то андозаи корт ҳаргиз хеле
 * хурд нашавад, ва `1fr` (на ҳадди боло/px собит) кафолат медиҳад, ки
 * фазои холии уфуқӣ намонад — сутунҳои мавҷуда токи охир паҳн мешаванд.
 */
export const ITEM_GRID_CLASS =
  "grid gap-2 sm:gap-3 md:gap-3 lg:gap-4 xl:gap-5 " +
  "grid-cols-[repeat(auto-fill,minmax(140px,1fr))] " +
  "sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] " +
  "md:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] " +
  "lg:grid-cols-[repeat(auto-fill,minmax(195px,1fr))] " +
  "xl:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] " +
  "2xl:grid-cols-[repeat(auto-fill,minmax(225px,1fr))]";
