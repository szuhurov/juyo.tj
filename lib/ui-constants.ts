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

/**
 * Grid-и саҳифаи АСОСӢ — бар хилофи ITEM_GRID_CLASS шумораи СОБИТИ
 * сутунҳо дорад (2 дар мобилӣ), чунки филтрбари fixed-и боло ва
 * padding-и мӯҳтаво ба ҳамин зинаҳо (855/1084/1503/1920) басташудаанд.
 *
 * Ин константа маҳз барои он ҷудо аст, ки skeleton ва рӯйхати воқеӣ
 * ҲАМЕША як хел бошанд — пештар loading.tsx ITEM_GRID_CLASS-и дигарро
 * истифода мебурд ва ҳангоми омадани маълумот тарҳбандӣ меҷаҳид.
 */
export const HOME_GRID_CLASS =
  "grid grid-cols-2 min-[855px]:grid-cols-3 min-[1084px]:grid-cols-4 " +
  "min-[1503px]:grid-cols-5 min-[1920px]:grid-cols-6 " +
  "gap-3 sm:gap-4 min-[1084px]:gap-5";

/**
 * Падинги болои мӯҳтавои саҳифаи асосӣ — баландии филтрбари fixed.
 * Ҳам рӯйхат, ҳам skeleton бояд аз ҳамин истифода баранд.
 */
export const HOME_CONTENT_PT =
  "pt-[161px] min-[768px]:pt-[177px] min-[1084px]:pt-[185px] " +
  "min-[1503px]:pt-[193px] min-[1920px]:pt-[201px]";

/**
 * Алоқа байни саҳифаи илова ва рӯйхати эълонҳо.
 *
 * "Тамом" ФАВРАН ба профил мегузарад — сабти эълон дар паси парда идома
 * меёбад ва метавонад баъд аз гузариш тамом шавад. Пас id-и эълони нав
 * бо event эълон карда мешавад (агар рӯйхат аллакай кушода бошад) ва
 * ҳамзамон дар sessionStorage навишта мешавад (агар рӯйхат баъдтар
 * кушода шавад). Рӯйхат онро гирифта, дар болои ҳамон корт ҳисобкунаки
 * санҷишро нишон медиҳад.
 */
export const JUST_PUBLISHED_EVENT = "juyo-item-published";
export const JUST_PUBLISHED_KEY = "juyo-just-published";

/** Ҳисобкунак ба `startedAt` баста мешавад, на ба лаҳзаи пайдо шудани
 *  корт — вагарна он баъд аз боркунии аксҳо (3-5 сония) аз нав аз 10
 *  сар мешуд, дар ҳоле ки санҷиш аллакай кайҳо оғоз шудааст. */
export const PUBLISH_COUNTDOWN_SECONDS = 10;
export const PUBLISH_COUNTDOWN_MS = PUBLISH_COUNTDOWN_SECONDS * 1000;

export interface JustPublishedState {
  /** То тамом шудани сабт маълум нест. */
  id?: string;
  /** Лаҳзаи пахши "Нашр" (Date.now()). */
  startedAt: number;
}
