/**
 * Client-side part of the home page (filters, infinite scroll, search).
 * initialItems comes from the server (see page.tsx) — so the initial HTML
 * already has the items (SEO), without waiting for a client-side fetch.
 */
"use client";

import { useState, useRef, Suspense, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
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
  LayoutGrid,
  Building2,
  HelpCircle,
  Dumbbell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangeCalendar } from "@/components/date-range-calendar";

// Quick action buttons — location_type filter (replacing the old dedicated
// "Taxi" button, which only filtered by one fixed user — see migration
// 20260802000000_items_location_type.sql). This filter is GENERAL for all
// users, based on the answer to the wizard question in items/add. "all" does not
// correspond to a location_type value — it's the button that clears this filter, not a real filter.
// BUG FOUND (user request: these filters differ from mobile):
// previously this had made-up "gym"/"fintech_center" values that don't
// exist at all in native. Now it's EXACTLY the same 6 that native
// has (see app/(tabs)/index.tsx) — "none" is special: not "no
// filter" (that's "all"), but "specifically the listings that didn't
// specify a location" (location_type IS NULL — the search_items RPC
// understands this string specially, see p_location_type='none').
const QUICK_ACTIONS = [
  { value: "all", icon: LayoutGrid },
  { value: "taxi", icon: Car },
  { value: "hotel_restaurant", icon: Hotel },
  { value: "airport", icon: Plane },
  { value: "public_place", icon: Building2 },
  { value: "gym", icon: Dumbbell },
  { value: "none", icon: HelpCircle },
] as const;

// SORTED copy for the home filter (not CATEGORIES itself) — "Other"
// stays at the end, but the original order of CATEGORIES (used for the
// category step of the items/add wizard) remains untouched. The exact same
// pattern is used on mobile (juyoapp/app/(tabs)/index.tsx — CAT_FILTER_ITEMS).
const CATEGORY_FILTER_ITEMS = [...CATEGORIES].sort((a, b) =>
  a.name === "Other" ? 1 : b.name === "Other" ? -1 : 0,
);

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

  // Filters are kept in the URL, not in useState.
  //
  // REASON: previously they were local state — the user would filter,
  // open a listing, and on going back the component would be rebuilt,
  // meaning all filters reset to "All" and the scroll jumped to the top.
  // With the URL, the state belongs to the browser history itself: going
  // back restores it automatically, and at the same time the filtered
  // list becomes a shareable link.
  const router = useRouter();
  const pathname = usePathname();

  const category = searchParams.get("cat") || "All";
  // Default — "All" (user request): an empty `type` means "All"
  // and keeps the home page URL clean — `?type=` only appears for
  // "Found"/"Lost" (not the other way around, like before).
  const rawType = searchParams.get("type");
  const itemType: "lost" | "found" | null =
    rawType === "lost" || rawType === "found" ? rawType : null;
  const locationType = searchParams.get("loc") || null;
  const dateFrom = searchParams.get("from") || undefined;
  const dateTo = searchParams.get("to") || undefined;

  // `replace` (not `push`) — otherwise every filter click would create a
  // history entry and the "back" button would step the user through dozens
  // of filter states instead of taking them to the previous page.
  const setFilterParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();

      // INFINITE LOOP — mandatory guard.
      // `router.replace` creates a NEW searchParams object → `useCallback`
      // is recreated → every effect that depends on it runs again →
      // `replace` again… If the URL doesn't actually change,
      // don't navigate at all.
      if (qs === searchParams.toString()) return;

      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const setCategory = (value: string) =>
    setFilterParams({ cat: value === "All" ? null : value });
  // "All" is the default — we strip it from the URL so the address stays
  // clean (the same logic as `setCategory` with "All").
  const setItemType = (value: "lost" | "found" | null) =>
    setFilterParams({ type: value });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const datePickerRef = useRef<HTMLDivElement>(null);

  /**
   * The ACTUAL height of the fixed filter bar — measured live, not an
   * estimated constant. Previously `HOME_CONTENT_PT` was a hand-picked
   * number (and often WRONG): either too much empty space was left, or
   * worse — the quick action buttons ended up hidden under the bar (user
   * request, demonstrated with a screenshot).
   * `ResizeObserver` immediately tracks every height change (e.g. a
   * breakpoint switch), so it never drifts from reality.
   */
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [filterBarHeight, setFilterBarHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = filterBarRef.current;
    if (!el) return;
    const measure = () => setFilterBarHeight(el.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  // Clear all filters — in a single URL update, so it doesn't cause two
  // consecutive renders.
  const clearAllFilters = useCallback(() => {
    setFilterParams({ cat: null, type: null, loc: null, from: null, to: null });
  }, [setFilterParams]);

  // initialItems applies only for the default filters (i.e. the same ones
  // that were fetched on the server) — filters differing from the default
  // mean the user has already changed a filter.
  // `type === "found"` is the DEFAULT, not a filter chosen by the user — so
  // it still counts as the default state. Otherwise `isDefaultFilters` would
  // always be `false`, the server's `initialItems` would never be used, and
  // every load would trigger an extra client-side fetch (see page.tsx — it
  // fetches with exactly this same filter).
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

  // Load the next page when the end of the list is reached
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
  // `handledVisualRef` guarantees the body runs once per NEW result — not
  // every time `clearAllFilters`'s identity changes (it depends on
  // searchParams and gets a new identity after every navigation).
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

  // User request: the quick action buttons (taxi/hotel/... row) must be
  // visible every time the user clicks one of the filters ABOVE (category,
  // type, date).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [category, itemType, dateFrom, dateTo]);

  // Reset everything when user clicks the home logo
  //
  // `handledGoHomeRef` is MANDATORY — the same guard used in the effect
  // above (`handledVisualRef`). Without it, the effect would run on EVERY
  // URL change, because `clearAllFilters` depends on `searchParams` and
  // gets a new identity after every navigation. The result: once the user
  // clicked the "Home" button from another page (goHomeSignal ≠ 0), every
  // subsequent filter click would be instantly canceled — the button would
  // revert to its previous state and the URL would stay clean.
  const handledGoHomeRef = useRef(0);
  useEffect(() => {
    // Sync with the external signal (goHomeSignal from context).
    if (goHomeSignal === 0) return;
    if (handledGoHomeRef.current === goHomeSignal) return;
    handledGoHomeRef.current = goHomeSignal;
    setVisualSearchResults(null);
    clearAllFilters();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [goHomeSignal, setVisualSearchResults, clearAllFilters]);

  // Close the date filter popup on click outside it
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

  // Flatten all items from all pages
  const allItems = useMemo(() => {
    return data?.pages.flatMap((page) => page) || [];
  }, [data]);

  // "Pro" approach: display items without extra frontend filtering (since the backend already filters)
  const displayedItems = useMemo(() => {
    if (visualSearchResults) return visualSearchResults;
    return allItems;
  }, [allItems, visualSearchResults]);

  // The quick action buttons stay visible during TEXT SEARCH as well.
  // During VISUAL search this row is still hidden, because there the
  // whole strip is replaced by the "clear results" button and the
  // padding is different too (pt-[64px]).
  const showTopSections = !visualSearchResults;

  return (
    <div className="pb-18 min-h-screen bg-canvas">
      {/* Filters section (Header/Filters) */}
      <div ref={filterBarRef} className="fixed top-12 sm:top-16 left-0 right-0 z-40 bg-canvas">
        <div className="w-full max-w-7xl mx-auto pl-2.5 sm:pl-4">
          {/* The header itself already sits 6px below the search field, so `pt-0.5`
              bumps the gap to 8px — slightly larger than the 6px between filter
              rows, so the search field appears visually separated from them.
              `pb-1.5` (6px): user request — the entire gap between the type row and
              the content below should come from here (not from the bottom content's
              margin), so that even when the quick action buttons aren't visible
              (e.g. the list has scrolled to the edge of the bar), the same gap
              remains.
              This number no longer depends on the hand-picked HOME_CONTENT_PT — the
              content padding now measures this bar's ACTUAL height live (filterBarHeight). */}
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
                  {CATEGORY_FILTER_ITEMS.map((cat) => {
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

          {/* Type selector: Lost or Found — a separate row, no swipe (few buttons) */}
          {!visualSearchResults && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {/* The color follows the same convention as the cards: found is green, lost is red.
                    When inactive the color is on the TEXT, when active it's on the
                    BACKGROUND — otherwise red text would end up on a green background. */}
                {(
                  [
                    { value: null, label: t("all"), on: "bg-emerald-500 text-white", off: "bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400" },
                    { value: "found", label: t("filterFound"), on: "bg-emerald-500 text-white", off: "bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400" },
                    { value: "lost", label: t("filterLost"), on: "bg-rose-500 text-white", off: "bg-white dark:bg-zinc-800 text-rose-700 dark:text-rose-400" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value ?? "all"}
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

                {/* Date range filter (From/To) — pushed to the right edge of the row (ml-auto) */}
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
                    <>
                      {/* Dark backdrop — to draw attention to the filter itself and let
                          clicking outside close it. Previously this filter was a
                          dropdown that stuck to the right edge on phone screens and
                          half of it ended up off-screen. */}
                      <div
                        className="fixed inset-0 z-40 bg-black/50"
                        onClick={() => setShowDatePicker(false)}
                        aria-hidden
                      />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 shadow-lg p-3 space-y-2.5">
                      <DateRangeCalendar
                        from={draftFrom || undefined}
                        to={draftTo || undefined}
                        onChange={({ from, to }) => {
                          setDraftFrom(from || "");
                          setDraftTo(to || "");
                        }}
                      />
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
                    </>
                  )}
                </div>
            </div>
          )}
          </div>

        </div>
      </div>

      {/* Main content: Listings feed */}
      <div
        className={cn(
          "w-full max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-5 touch-pan-y",
          visualSearchResults
            ? "pt-[64px] md:pt-[72px] min-[1084px]:pt-[80px] min-[1503px]:pt-[88px] min-[1920px]:pt-[96px]"
            // Until the live measurement (filterBarHeight) is ready, the
            // estimated HOME_CONTENT_PT class is used — otherwise there
            // would be no padding at all on the very first render (SSR/before JS).
            : filterBarHeight == null && HOME_CONTENT_PT,
        )}
        style={!visualSearchResults && filterBarHeight != null ? { paddingTop: filterBarHeight } : undefined}
      >
        {/* Quick action buttons — inside the SCROLLABLE content, not in the
            fixed bar. When scrolling they move up and hide under the filter bar;
            they only reappear when the filters above are clicked (category/type/
            date) or on a full scroll back to the top — user request: "like
            before... it should reappear once we get back to the top" (not on
            every small upward scroll movement).
            NO margin-top: the 6px gap comes from the `pb-1.5` inside the fixed
            bar (see above).
            `py-5 -my-5` is room for the shadow, so the shadow isn't clipped. */}
        {showTopSections && (
          <div className="mb-2.5">
            {/* `mr-[-Npx]`: the row must reach the ACTUAL right edge of the screen. */}
            <div className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory no-scrollbar py-5 -my-5 mr-[-10px] sm:mr-[-16px] lg:mr-[-20px]">
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
                        "w-8 h-8 min-[1503px]:w-9 min-[1503px]:h-9 min-[1920px]:w-10 min-[1920px]:h-10 shrink-0",
                        active ? "text-white" : "text-emerald-500 dark:text-emerald-400",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isLoading &&
        allItems.length === 0 &&
        !searchQuery &&
        category === "All" &&
        itemType === null &&
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

            {/* Element for Infinite Scroll */}
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

            {/* End of the list. The text differs depending on state: if a
                filter/search is active, the user should understand that this is
                the end of THIS result set, not the end of all listings —
                otherwise they might think there's nothing else on the site. There's
                no pagination for visual search results, so this text isn't shown there. */}
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
