/**
 * The 18 official cities (plus a trailing "other") a listing can belong to, in DISPLAY order (most
 * populated / best known first, Dushanbe always first and the default).
 * The ids are the values stored in `items.city` — they must stay in sync with
 * the `items_city_check` constraint (see supabase/migrations/20260919000000_items_city.sql)
 * and with app/lib/cities.ts.
 */
export const DEFAULT_CITY = "dushanbe";

export const CITY_IDS = [
  "dushanbe", "khujand", "bokhtar", "kulob", "tursunzoda", "istaravshan",
  "vahdat", "hisor", "panjakent", "khorugh", "isfara", "konibodom",
  "norak", "roghun", "guliston", "buston", "istiqlol", "levakant", "other",
] as const;

export type CityId = (typeof CITY_IDS)[number];

const CITY_LABELS: Record<string, Record<CityId, string>> = {
  tg: {
    dushanbe: "Душанбе", khujand: "Хуҷанд", bokhtar: "Бохтар", kulob: "Кӯлоб",
    tursunzoda: "Турсунзода", istaravshan: "Истаравшан", vahdat: "Ваҳдат", hisor: "Ҳисор",
    panjakent: "Панҷакент", khorugh: "Хоруғ", isfara: "Исфара", konibodom: "Конибодом",
    norak: "Норак", roghun: "Роғун", guliston: "Гулистон", buston: "Бӯстон",
    istiqlol: "Истиқлол", levakant: "Левакант", other: "Дигар",
  },
  ru: {
    dushanbe: "Душанбе", khujand: "Худжанд", bokhtar: "Бохтар", kulob: "Куляб",
    tursunzoda: "Турсунзаде", istaravshan: "Истаравшан", vahdat: "Вахдат", hisor: "Гиссар",
    panjakent: "Пенджикент", khorugh: "Хорог", isfara: "Исфара", konibodom: "Канибадам",
    norak: "Нурек", roghun: "Рогун", guliston: "Гулистон", buston: "Бустон",
    istiqlol: "Истиклол", levakant: "Левакант", other: "Другое",
  },
  en: {
    dushanbe: "Dushanbe", khujand: "Khujand", bokhtar: "Bokhtar", kulob: "Kulob",
    tursunzoda: "Tursunzoda", istaravshan: "Istaravshan", vahdat: "Vahdat", hisor: "Hisor",
    panjakent: "Panjakent", khorugh: "Khorugh", isfara: "Isfara", konibodom: "Konibodom",
    norak: "Norak", roghun: "Roghun", guliston: "Guliston", buston: "Buston",
    istiqlol: "Istiqlol", levakant: "Levakant", other: "Other",
  },
};

export function cityLabel(id: string, locale: string): string {
  const table = CITY_LABELS[locale] ?? CITY_LABELS.en;
  return table[id as CityId] ?? id;
}
