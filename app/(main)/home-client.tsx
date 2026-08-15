/**
 * Қисми клиентии саҳифаи асосӣ (филтрҳо, infinite scroll, ҷустуҷӯ).
 * initialItems аз сервер (ниг. page.tsx) меояд — то HTML-и аввалия
 * итемҳоро аллакай дошта бошад (SEO), бе интизори fetch-и клиентӣ.
 */
"use client";

import { useState, useRef, Suspense, useEffect, useMemo, useCallback } from "react";
import { CATEGORIES, type Item } from "@/lib/services/item-service";
import { ItemFeedCard } from "@/components/item-feed-card";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";
import { ItemCardSkeleton } from "@/components/item-card-skeleton";
import { HomeFiltersSkeleton } from "@/components/home-filters-skeleton";
import { HOME_GRID_CLASS, HOME_CONTENT_PT } from "@/lib/ui-constants";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useItems } from "@/lib/hooks/use-items";
import { useQueryClient } from "@tanstack/react-query";
import { useHomeState } from "@/lib/home-context";
import { useInView } from "react-intersection-observer";
import {
  X,
  CalendarDays,
  Car,
  Plane,
  Hotel,
  Landmark,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Тугмаҳои амали зуд — филтри location_type (ба ҷои тугмаи куҳнаи "Такси"-и
// махсус, ки танҳо аз рӯи як корбари собит филтр мекард — ниг. migration
// 20260802000000_items_location_type.sql). Ин филтри УМУМӢ барои ҳамаи
// корбарон аст, аз рӯи посух ба саволи wizard-и items/add. "all" маънии
// location_type-и нест дорад — тугмаи тоза кардани ин филтр, на филтри воқеӣ.
const QUICK_ACTIONS = [
  { value: "all", icon: LayoutGrid },
  { value: "taxi", icon: Car },
  { value: "hotel_restaurant", icon: Hotel },
  { value: "airport", icon: Plane },
  { value: "public_place", icon: Landmark },
] as const;

function HomeContent({ initialItems }: { initialItems?: Item[] }) {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") || "";
  const queryClient = useQueryClient();
  const { ref, inView } = useInView();

  const {
    visualSearchResults,
    isSearchTyping,
    goHomeSignal,
    setVisualSearchResults,
  } = useHomeState();

  // Филтрҳо дар URL нигоҳ дошта мешаванд, на дар useState.
  //
  // САБАБ: пеш аз ин онҳо ҳолати локалӣ буданд — корбар филтр мекард,
  // ба эълон медаромад ва ҳангоми бозгашт компонент аз нав сохта мешуд,
  // яъне ҳамаи филтрҳо ба "Ҳама" бармегаштанд ва scroll ба боло меафтод.
  // Бо URL ҳолат ба худи таърихи браузер тааллуқ дорад: бозгашт онро
  // худкор барқарор мекунад, ва ҳамзамон рӯйхати филтршуда пайванди
  // мубодилашаванда мешавад.
  const router = useRouter();
  const pathname = usePathname();

  const category = searchParams.get("cat") || "All";
  // Пешфарз — «Ёфтшуда»: одам аввал чизи ёфтшударо мебинад. Ҳолати «Ҳама»
  // дигар нест, пас `type`-и холӣ маънои «Ёфтшуда»-ро дорад ва URL-и
  // саҳифаи асосӣ тоза мемонад (`?type=` танҳо барои «Гумшуда» пайдо мешавад).
  const itemType = (searchParams.get("type") as "lost" | "found") || "found";
  const locationType = searchParams.get("loc") || null;
  const dateFrom = searchParams.get("from") || undefined;
  const dateTo = searchParams.get("to") || undefined;

  // `replace` (на `push`) — вагарна ҳар як зеркунии филтр як қадами
  // таърих месозад ва тугмаи "қафо" корбарро аз байни даҳҳо ҳолати
  // филтр мегузаронад, ба ҷои он ки ба саҳифаи қаблӣ барад.
  const setFilterParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();

      // ҲАЛҚАИ БЕПОЁН — муҳофизати ҳатмӣ.
      // `router.replace` объекти НАВи searchParams месозад → `useCallback`
      // аз нав эҷод мешавад → ҳар effect-е, ки ба он вобаста аст, дубора
      // кор мекунад → боз `replace`… Агар URL воқеан тағйир наёбад,
      // умуман navigation накун.
      if (qs === searchParams.toString()) return;

      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const setCategory = (value: string) =>
    setFilterParams({ cat: value === "All" ? null : value });
  // «Ёфтшуда» пешфарз аст — онро аз URL мебарорем, то суроға тоза монад
  // (ҳамон мантиқи `setCategory` бо "All").
  const setItemType = (value: "lost" | "found") =>
    setFilterParams({ type: value === "found" ? null : value });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const datePickerRef = useRef<HTMLDivElement>(null);

  const filters = useMemo(
    () => ({
      category: category === "All" ? undefined : category,
      type: itemType || undefined,
      search: searchQuery,
      dateFrom,
      dateTo,
      locationType: locationType || undefined,
    }),
    [category, itemType, searchQuery, dateFrom, dateTo, locationType],
  );

  const setLocationType = (value: string | null) =>
    setFilterParams({ loc: value });

  const toggleLocationType = (value: string) =>
    setFilterParams({ loc: locationType === value ? null : value });

  // Тоза кардани ҳамаи филтрҳо — дар як навсозии URL, то ду render-и
  // пайдарпай нашавад.
  const clearAllFilters = useCallback(() => {
    setFilterParams({ cat: null, type: null, loc: null, from: null, to: null });
  }, [setFilterParams]);

  // initialItems танҳо барои filters-и пешфарз (яъне ҳамон чизе, ки дар
  // сервер гирифта шуда буд) амал мекунад — фарқи filters аз пешфарз
  // маънои онро дорад, ки корбар аллакай филтреро иваз кардааст.
  // `type === "found"` ПЕШФАРЗ аст, на филтри интихобкардаи корбар — пас он
  // ҳолати пешфарз ба ҳисоб меравад. Вагарна `isDefaultFilters` ҳамеша
  // `false` мешуд, `initialItems`-и сервер ҳеҷ гоҳ истифода намешуд ва ҳар
  // боркунӣ як fetch-и зиёдатии клиентӣ медод (ниг. page.tsx — он низ маҳз
  // ҳамин филтрро мегирад).
  const isDefaultFilters =
    !filters.category && filters.type === "found" && !filters.search && !filters.dateFrom && !filters.dateTo && !filters.locationType;

  const {
    data,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useItems(filters, isDefaultFilters ? initialItems : undefined);

  // Боркунии саҳифаи навбатӣ ҳангоми расидан ба охири рӯйхат
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const handleItemsUpdate = () =>
      queryClient.invalidateQueries({ queryKey: ["items", "list"] });
    const handleSavedUpdate = () =>
      queryClient.invalidateQueries({ queryKey: ["items", "saved"] });
    window.addEventListener("items-updated", handleItemsUpdate);
    window.addEventListener("saved-items-updated", handleSavedUpdate);
    return () => {
      window.removeEventListener("items-updated", handleItemsUpdate);
      window.removeEventListener("saved-items-updated", handleSavedUpdate);
    };
  }, [queryClient]);

  // Reset filters when visual search results arrive.
  // `handledVisualRef` кафолат медиҳад, ки бадан як бор ба ҳар натиҷаи
  // НАВ иҷро шавад — на ҳар дафъае, ки шахсияти `clearAllFilters` иваз
  // мешавад (он аз searchParams вобаста аст ва пас аз ҳар navigation нав
  // мешавад).
  const handledVisualRef = useRef<unknown>(null);
  useEffect(() => {
    if (!visualSearchResults) {
      handledVisualRef.current = null;
      return;
    }
    if (handledVisualRef.current === visualSearchResults) return;
    handledVisualRef.current = visualSearchResults;
    clearAllFilters();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [visualSearchResults, clearAllFilters]);

  // Reset everything when user clicks the home logo
  //
  // `handledGoHomeRef` ҲАТМӢ аст — худи ҳамон муҳофизат, ки дар effect-и
  // болоӣ (`handledVisualRef`) ҳаст. Бе он effect ба ҲАР тағйири URL кор
  // мекард, зеро `clearAllFilters` аз `searchParams` вобаста аст ва баъд аз
  // ҳар navigation шахсияти нав мегирад. Натиҷа: агар корбар як бор
  // тугмаи «Home»-ро аз саҳифаи дигар зада бошад (goHomeSignal ≠ 0), пас
  // ҳар зеркунии филтр фавран бекор мешуд — тугма ба ҳолати пештара
  // бармегашт ва URL тоза мемонд.
  const handledGoHomeRef = useRef(0);
  useEffect(() => {
    // Синхронизатсия бо сигнали берунӣ (goHomeSignal аз context).
    if (goHomeSignal === 0) return;
    if (handledGoHomeRef.current === goHomeSignal) return;
    handledGoHomeRef.current = goHomeSignal;
    setVisualSearchResults(null);
    clearAllFilters();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [goHomeSignal, setVisualSearchResults, clearAllFilters]);

  // Пӯшидани попапи филтри сана ҳангоми клик берун аз он
  useEffect(() => {
    if (!showDatePicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDatePicker]);

  const openDatePicker = () => {
    setDraftFrom(dateFrom ?? "");
    setDraftTo(dateTo ?? "");
    setShowDatePicker((v) => !v);
  };

  const applyDateFilter = () => {
    setFilterParams({ from: draftFrom || null, to: draftTo || null });
    setShowDatePicker(false);
  };

  const clearDateFilter = () => {
    setFilterParams({ from: null, to: null });
    setDraftFrom("");
    setDraftTo("");
    setShowDatePicker(false);
  };

  // Ҷамъоварии ҳамаи ашёҳо аз ҳамаи саҳифаҳо
  const allItems = useMemo(() => {
    return data?.pages.flatMap((page) => page) || [];
  }, [data]);

  // Усули"Pro": Намоиши ашёҳо бидуни филтри зиёдатии фронтенд (чун backend аллакай филтр мекунад)
  const displayedItems = useMemo(() => {
    if (visualSearchResults) return visualSearchResults;
    return allItems;
  }, [allItems, visualSearchResults]);

  // Тугмаҳои амали зуд ҳангоми ҶУСТУҶӮИ МАТНӢ низ намоён мемонанд.
  // Пештар онҳо бо `!searchQuery` пинҳон мешуданд, вале падинги мӯҳтаво
  // (HOME_CONTENT_PT) баландии ҳар СЕ қатори филтрбари fixed-ро ҳисоб
  // мекунад — дар натиҷа зери филтрҳо як холигии калон мемонд.
  // Ҳангоми ҷустуҷӯи ВИЗУАЛӢ ин қатор ҳамоно пинҳон мешавад, чунки он ҷо
  // тамоми навор ба тугмаи "тоза кардани натиҷа" иваз мешавад ва падинг
  // низ дигар аст (pt-[64px]).
  const showTopSections = !visualSearchResults;

  return (
    <div className="pb-18 min-h-screen bg-canvas">
      {/* Қисмати Филтрҳо (Header/Filters) */}
      <div className="fixed top-12 sm:top-16 left-0 right-0 z-40 bg-canvas">
        <div className="w-full max-w-7xl mx-auto pl-2.5 sm:pl-4">
          {/* Худи header аллакай 6px зери майдони ҷустуҷӯ мемонад, пас `pt-0.5`
              фосиларо ба 8px мебарорад — каме калонтар аз 6px-и байни қаторҳои
              филтр, то ҷустуҷӯ аз онҳо ҷудо ба назар расад. `py-1.5`-и пештара
              12px медод, ки аз ҳад зиёд буд.
              ДИҚҚАТ: ҳар тағйири ин рақам баландии бари fixed-ро иваз мекунад —
              `HOME_CONTENT_PT` бояд ҳамон қадар иваз шавад, вагарна зери бар
              холигӣ мемонад ё кортҳо зери он медароянд. */}
          <div className="w-full pt-0.5 pb-1.5">
          <div
            className={cn(
              "flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 py-2.5 -my-2.5",
              visualSearchResults && "w-full justify-end",
            )}
          >
              {visualSearchResults ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisualSearchResults(null)}
                  className="rounded-full h-8 text-[10px] font-bold tracking-widest border-none bg-white text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400"
                >
                  <X className="h-3.5 w-3.5 mr-2" />
                  {t("clearResults")}
                </Button>
              ) : (
                <>
                  <button
                    onClick={() => setCategory("All")}
                    className={cn(
                      "shrink-0 px-3 md:px-4 min-[1084px]:px-5 min-[1920px]:px-[22px] h-7 md:h-9 min-[1084px]:h-10 min-[1920px]:h-[42px] rounded-full font-bold text-[11px] min-[1084px]:text-xs min-[1920px]:text-[13px] tracking-wide cursor-pointer whitespace-nowrap",
                      category === "All"
                        ? "bg-emerald-500 text-white"
                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
                    )}
                  >
                    {t("all")}
                  </button>
                  {CATEGORIES.map((cat) => {
                    const active = category === cat.name;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setCategory(cat.name)}
                        className={cn(
                          "shrink-0 px-3 md:px-4 min-[1084px]:px-5 min-[1920px]:px-[22px] h-7 md:h-9 min-[1084px]:h-10 min-[1920px]:h-[42px] rounded-full font-bold text-[11px] min-[1084px]:text-xs min-[1920px]:text-[13px] tracking-wide flex items-center gap-1.5 cursor-pointer whitespace-nowrap",
                          active
                            ? "bg-emerald-500 text-white"
                            : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
                        )}
                      >
                        {t(`categories.${cat.id}`)}
                      </button>
                    );
                  })}
                </>
              )}
          </div>

          {/* Интихоби навъ: Гумшуда ё Ёфтшуда — қатори алоҳида, бе swipe (адади ками tugma) */}
          {!visualSearchResults && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {/* Ранг ҳамон забони кортҳост: ёфтшуда сабз, гумшуда сурх.
                    Ҳангоми ғайрифаъол ранг дар МАТН аст, ҳангоми фаъол дар
                    ЗАМИНА — вагарна матни сурх дар заминаи сабз меафтод. */}
                {(
                  [
                    { value: "found", label: t("filterFound"), on: "bg-emerald-500 text-white", off: "bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400" },
                    { value: "lost", label: t("filterLost"), on: "bg-rose-500 text-white", off: "bg-white dark:bg-zinc-800 text-rose-700 dark:text-rose-400" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setItemType(opt.value)}
                    aria-pressed={itemType === opt.value}
                    className={cn(
                      "px-3 md:px-4 min-[1084px]:px-5 min-[1920px]:px-[22px] h-7 md:h-9 min-[1084px]:h-10 min-[1920px]:h-[42px] rounded-full font-bold text-[11px] min-[1084px]:text-xs min-[1920px]:text-[13px] tracking-wide cursor-pointer",
                      itemType === opt.value ? opt.on : opt.off,
                    )}
                  >
                    {opt.label}
                  </button>
                ))}

                {/* Филтри бозаи сана (Аз/То) — то лаби рости қатор тела дода мешавад (ml-auto) */}
                <div className="relative ml-auto mr-2" ref={datePickerRef}>
                  <button
                    type="button"
                    onClick={openDatePicker}
                    aria-label={t("filterByDate")}
                    className={cn(
                      "h-7 w-7 md:h-9 md:w-9 min-[1503px]:h-10 min-[1503px]:w-10 min-[1920px]:h-[42px] min-[1920px]:w-[42px] flex items-center justify-center rounded-full cursor-pointer",
                      dateFrom || dateTo
                        ? "bg-emerald-500 text-white"
                        : "bg-white dark:bg-zinc-800 text-emerald-500 dark:text-emerald-400",
                    )}
                  >
                    <CalendarDays className="w-4 h-4 md:w-5 md:h-5 min-[1503px]:w-[22px] min-[1503px]:h-[22px]" />
                  </button>

                  {showDatePicker && (
                    <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 shadow-lg p-3 space-y-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                          {t("dateFrom")}
                        </label>
                        <input
                          type="date"
                          value={draftFrom}
                          max={draftTo || undefined}
                          onChange={(e) => setDraftFrom(e.target.value)}
                          className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                          {t("dateTo")}
                        </label>
                        <input
                          type="date"
                          value={draftTo}
                          min={draftFrom || undefined}
                          onChange={(e) => setDraftTo(e.target.value)}
                          className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                        />
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={clearDateFilter}
                          className="text-[11px] font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                        >
                          {t("clearFilter")}
                        </button>
                        <button
                          type="button"
                          onClick={applyDateFilter}
                          className="px-3 h-8 rounded-lg bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                        >
                          {t("applyFilter")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
            </div>
          )}
          {/* Тугмаҳои амали зуд — дар ДОХИЛИ бари fixed, то ҳангоми scroll
                дар ҷои худ истанд ва зери филтрҳои дигар нараванд.
  
              `py-5 -my-5` ҷои соя аст, то соя бурида нашавад. */}
          {showTopSections && (
            <div className="mt-1.5">
              <div className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory no-scrollbar py-5 -my-5">
                {QUICK_ACTIONS.map(({ value, icon: Icon }) => {
                  const active = value === "all" ? locationType === null : locationType === value;
                  return (
                    <button
                      key={value}
                      onClick={() =>
                        value === "all" ? setLocationType(null) : toggleLocationType(value)
                      }
                      className={cn(
                        "shrink-0 snap-start w-[37%] min-[480px]:w-36 min-[1503px]:w-40 min-[1920px]:w-[168px] flex items-center justify-between gap-1.5 px-2.5 py-2.5 min-[1503px]:py-3 rounded-xl text-left cursor-pointer",
                        active ? "bg-emerald-500" : "bg-white dark:bg-zinc-800",
                      )}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span
                          className={cn(
                            "font-bold text-xs min-[1503px]:text-[13px] min-[1920px]:text-sm leading-tight tracking-wide truncate",
                            active ? "text-white" : "text-zinc-900 dark:text-zinc-100",
                          )}
                        >
                          {t(`quickActions.${value}.title`)}
                        </span>
                        <span
                          className={cn(
                            "text-left font-semibold text-[10px] min-[1503px]:text-[11px] min-[1920px]:text-xs leading-tight tracking-wide whitespace-nowrap truncate",
                            active ? "text-white/70" : "text-zinc-400 dark:text-zinc-500",
                          )}
                        >
                          {t(`quickActions.${value}.desc`)}
                        </span>
                      </div>
                      <Icon
                        className={cn(
                          "w-7 h-7 min-[1503px]:w-8 min-[1503px]:h-8 min-[1920px]:w-9 min-[1920px]:h-9 shrink-0",
                          active ? "text-white" : "text-emerald-500 dark:text-emerald-400",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          </div>

        </div>
      </div>

      {/* Мӯҳтавои асосиӣ: Рӯйхати эълонҳо */}
      <div
        className={cn(
          "w-full max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-5 touch-pan-y",
          visualSearchResults
            ? "pt-[64px] md:pt-[72px] min-[1084px]:pt-[80px] min-[1503px]:pt-[88px] min-[1920px]:pt-[96px]"
            : HOME_CONTENT_PT,
        )}
      >

        {isLoading &&
        allItems.length === 0 &&
        !searchQuery &&
        category === "All" &&
        itemType === "found" &&
        !isSearchTyping ? (
          <div className={HOME_GRID_CLASS}>
            {[...Array(8)].map((_, i) => (
              <ItemCardSkeleton key={i} />
            ))}
          </div>
        ) : displayedItems.length > 0 ? (
          <>
            <div className={HOME_GRID_CLASS}>
              {displayedItems.map((item) => (
                <ItemFeedCard key={item.id} item={item} />
              ))}
            </div>

            {/* Элемент барои Infinite Scroll */}
            <div
              ref={ref}
              className="h-10 mt-4 flex items-center justify-center"
            >
              {isFetchingNextPage && (
                <div className="flex gap-1.5 items-center">
                  <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce [animation-duration:0.8s]"></span>
                  <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce [animation-duration:0.8s] [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce [animation-duration:0.8s] [animation-delay:0.4s]"></span>
                </div>
              )}
            </div>

            {/* Анҷоми рӯйхат. Матн вобаста ба ҳолат фарқ мекунад: агар
                филтр/ҷустуҷӯ фаъол бошад, корбар бояд бифаҳмад, ки ин
                анҷоми ҲАМИН натиҷа аст, на анҷоми ҳамаи эълонҳо —
                вагарна метавонад фикр кунад, ки дар сайт чизи дигаре
                нест. Барои натиҷаи ҷустуҷӯи визуалӣ pagination нест,
                бинобар ин он ҷо ин матн намоиш дода намешавад. */}
            {!visualSearchResults && !hasNextPage && !isFetchingNextPage && (
              <p className="pb-6 text-center text-xs min-[1084px]:text-[13px] font-medium text-zinc-400 dark:text-zinc-500">
                {isDefaultFilters ? t("endOfListAll") : t("endOfListFiltered")}
              </p>
            )}
          </>
        ) : (
          <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
            <h2 className="text-xl font-bold tracking-tight flex items-center justify-center gap-1">
              {isLoading || isFetching || isSearchTyping ? (
                <>
                  {t("search")}
                  <span className="flex gap-1 items-center ml-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-duration:0.8s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-duration:0.8s] [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-duration:0.8s] [animation-delay:0.4s]"></span>
                  </span>
                </>
              ) : (
                t("noItemsFound")
              )}
            </h2>
            {!(isLoading || isFetching || isSearchTyping) && (
              <p className="text-zinc-500 text-sm mt-2">
                {t("noItemsSubtitle")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="pb-18 min-h-screen bg-canvas">
      <HomeFiltersSkeleton />
      <div className={cn("w-full max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-5", HOME_CONTENT_PT)}>
        <div className={HOME_GRID_CLASS}>
          {[...Array(8)].map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomeClient({ initialItems }: { initialItems?: Item[] }) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent initialItems={initialItems} />
    </Suspense>
  );
}
