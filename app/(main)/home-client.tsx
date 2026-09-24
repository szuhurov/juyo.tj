/**
 * Client-side part of the home page (filters, infinite scroll, search).
 * initialItems comes from the server (see page.tsx) — so the initial HTML
 * already has the items (SEO), without waiting for a client-side fetch.
 */
"use client";

import { useState, useRef, Suspense, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import {
  CATEGORIES,
  CATEGORY_IMAGES,
  CATEGORY_FILTER_IMAGES,
  ALL_CATEGORY_FILTER_IMAGE,
  type Item,
} from "@/lib/services/item-service";
import { ItemFeedCard } from "@/components/item-feed-card";
import { FeaturedPeopleCarousel } from "@/components/featured-people-carousel";
import {
  toFeaturedItems,
  excludeFeatured,
  isDefaultFeed,
  type FeaturedItem,
} from "@/lib/featured-people";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";
import { CITY_IDS, cityLabel } from "@/lib/cities";
import { ItemCardSkeleton } from "@/components/item-card-skeleton";
import { HomeFiltersSkeleton } from "@/components/home-filters-skeleton";
import { HOME_GRID_CLASS, HOME_CONTENT_PT } from "@/lib/ui-constants";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useItems, useVipItems } from "@/lib/hooks/use-items";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useHomeState } from "@/lib/home-context";
import { useInView } from "react-intersection-observer";
import dynamic from "next/dynamic";
import {
  X,
  SlidersHorizontal,
  Car,
  LayoutGrid,
  Plane,
  Hotel,
  Building2,
  Dumbbell,
  Search,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateRangeCalendar } from "@/components/date-range-calendar";
import { supabase } from "@/lib/supabase";

// Same next/dynamic split header.tsx used to use — this code only runs when
// a visual search is actually opened, so it stays out of the home page's
// main bundle.
const VisualSearchModal = dynamic(() =>
  import("@/components/visual-search-modal").then((m) => m.VisualSearchModal),
);
const CameraCaptureModal = dynamic(() =>
  import("@/components/camera-capture-modal").then((m) => m.CameraCaptureModal),
);

// Category filter card. A transparent-background 3D icon stands on its own
// (no tile, no scrim), with the label UNDER it; the selected category shows
// an emerald label + underline. Categories that don't have a transparent
// icon yet keep their pastel picture as a rounded square.
function CategoryFilterCard({
  label,
  image,
  transparent,
  wide,
  active,
  dimmed,
  onClick,
}: {
  label: string;
  image?: string;
  transparent: boolean;
  /** Wide pictures (Electronics, Clothing) get a 1.3:1 slot so they show as large as the square ones. */
  wide?: boolean;
  active: boolean;
  /** Another category is selected: show this one grey, like it is switched off. */
  dimmed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 cursor-pointer flex flex-col items-center gap-0 transition-[opacity,filter]",
        dimmed && "opacity-40 grayscale",
        // Mobile: 5.5 cells fit so the last one is cut in half (signals swiping); md+ keeps fixed widths.
        wide ? "w-[calc((100vw-20px)/5.5)] md:w-[104px] min-[1503px]:w-[125px]" : "w-[calc((100vw-20px)/5.5)] md:w-20 min-[1503px]:w-24",
      )}
    >
      <span
        className={cn(
          "relative block w-[76%] md:w-full",
          wide ? "aspect-square md:aspect-[1.3/1]" : "aspect-square",
          !transparent &&
            "rounded-md overflow-hidden bg-slate-100 dark:bg-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_5px_12px_-4px_rgba(15,23,42,0.07),0_12px_24px_-14px_rgba(15,23,42,0.09)] dark:shadow-none",
        )}
      >
        {image && (
          <Image
            src={image}
            alt=""
            fill
            sizes="112px"
            className={transparent ? "object-contain" : "object-cover"}
          />
        )}
      </span>
      <span
        className={cn(
          "-mt-1 text-[10px] min-[1503px]:text-[11px] font-medium tracking-wide whitespace-nowrap",
          active ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-600 dark:text-zinc-300",
        )}
      >
        {label}
      </span>
    </button>
  );
}

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
  { value: "airport", icon: Plane },
  { value: "public_place", icon: Building2 },
  { value: "hotel_restaurant", icon: Hotel },
  { value: "gym", icon: Dumbbell },
] as const;

// SORTED copy for the home filter (not CATEGORIES itself) — "Other"
// stays at the end, but the original order of CATEGORIES (used for the
// category step of the items/add wizard) remains untouched. Previously this
// just pinned "Other" last (a pattern mobile also used); the home filter now
// has its own explicit order (user request) — mobile (juyoapp/app/(tabs)/index.tsx
// — CAT_FILTER_ITEMS) no longer matches this ordering and would need updating too.
const CATEGORY_FILTER_ORDER = [
  "Wallet",
  "Keys",
  "Documents",
  "Bag",
  "Pets",
  "Cards",
  "Clothing",
  "LicensePlate",
  "Electronics",
  "Other",
];
const CATEGORY_FILTER_ITEMS = [...CATEGORIES].filter((c) => c.name !== "Phone").sort(
  (a, b) => CATEGORY_FILTER_ORDER.indexOf(a.name) - CATEGORY_FILTER_ORDER.indexOf(b.name),
);

function HomeContent({ initialItems }: { initialItems?: Item[] }) {
  const { t, locale } = useLanguage();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") || "";
  const queryClient = useQueryClient();
  const { ref, inView } = useInView();

  const {
    visualSearchResults,
    isSearchTyping,
    goHomeSignal,
    setVisualSearchResults,
    setIsSearchTyping,
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

  // Search bar — moved here from Header (user request): the header's
  // middle slot is freed up for the profile nav links, and the box only
  // ever needs to be visible on this page anyway. Unlike the old header
  // version, this component only ever renders on "/", so the "jump to
  // home first" branch that used to be needed there is gone.
  const [searchValue, setSearchValue] = useState(searchParams.get("q") || "");
  const [isVisualSearchOpen, setIsVisualSearchOpen] = useState(false);
  const [directFile, setDirectFile] = useState<File | null>(null);
  const [showPhotoChoice, setShowPhotoChoice] = useState(false);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // The visual search icon is only shown when AI is enabled — without it
  // no embedding is generated and image search returns no results.
  const { data: appSettings } = useQuery({
    queryKey: ["app-settings-ai-enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("ai_moderation_enabled")
        .eq("id", true)
        .maybeSingle();
      return data;
    },
    staleTime: 60 * 1000,
  });
  const aiEnabled = appSettings?.ai_moderation_enabled ?? false;

  // Sync the box FROM the URL — fixes the search box showing stale text
  // after browser back/forward.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchValue(searchParams.get("q") || "");
  }, [searchParams]);

  // Writes the search text to the URL. `replace` (not `push`): every typing
  // pause would otherwise add a history entry, so "back" would step through
  // half-typed queries instead of leaving the page. Back/forward to an older
  // entry still works — the URL→box sync effect above picks up its `q`.
  const commitSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }

      const qs = params.toString();
      if (window.location.search !== (qs ? `?${qs}` : "")) {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }

      setTimeout(() => setIsSearchTyping(false), 50);
    },
    [searchParams, pathname, router, setIsSearchTyping],
  );

  // Fires only when the user actually types (searchValue changes) — not on
  // unrelated URL changes from the other filters.
  useEffect(() => {
    if (searchValue === (searchParams.get("q") || "")) {
      setIsSearchTyping(false);
      return;
    }

    setIsSearchTyping(true);

    const delayDebounceFn = setTimeout(() => commitSearch(searchValue), 150);

    return () => clearTimeout(delayDebounceFn);
  }, [searchValue, searchParams, commitSearch, setIsSearchTyping]);

  const handlePhotoPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDirectFile(file);
      setIsVisualSearchOpen(true);
    }
    e.target.value = "";
  };

  const handleCameraCapture = (file: File) => {
    setDirectFile(file);
    setIsVisualSearchOpen(true);
  };

  const handleVisualSearchResults = (items: Item[]) => {
    setVisualSearchResults(items);
    setDirectFile(null);
  };

  const category = searchParams.get("cat") || "All";
  // Default — "All" (user request): an empty `type` means "All"
  // and keeps the home page URL clean — `?type=` only appears for
  // "Found"/"Lost" (not the other way around, like before).
  const rawType = searchParams.get("type");
  const itemType: "lost" | "found" | null =
    rawType === "lost" || rawType === "found" ? rawType : null;
  const locationType = searchParams.get("loc") || null;
  const city = searchParams.get("city") || null;
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
      city: city || undefined,
    }),
    [category, itemType, searchQuery, dateFrom, dateTo, locationType, city],
  );

  const setLocationType = (value: string | null) =>
    setFilterParams({ loc: value });

  const toggleLocationType = (value: string) =>
    setFilterParams({ loc: locationType === value ? null : value });

  // Clear all filters — in a single URL update, so it doesn't cause two
  // consecutive renders.
  const clearAllFilters = useCallback(() => {
    setFilterParams({ cat: null, type: null, loc: null, from: null, to: null, city: null });
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
    !filters.category && filters.type === "found" && !filters.search && !filters.dateFrom && !filters.dateTo && !filters.locationType && !filters.city;

  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
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
  }, [category, itemType, dateFrom, dateTo, city]);

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
    setFilterParams({ from: null, to: null, city: null });
    setDraftFrom("");
    setDraftTo("");
    setShowDatePicker(false);
  };

  // Flatten all items from all pages
  const allItems = useMemo(() => {
    return data?.pages.flatMap((page) => page) || [];
  }, [data]);

  // The quick action buttons stay visible during TEXT SEARCH as well.
  // During VISUAL search this row is still hidden, because there the
  // whole strip is replaced by the "clear results" button and the
  // padding is different too (pt-[64px]).
  const showTopSections = !visualSearchResults;

  // VIP/VVIP strip: only in the plain feed (no search, no filter). A failed
  // query just means no data → no strip, no error UI.
  const { data: vipItems } = useVipItems();
  const showStrip = showTopSections && isDefaultFeed(filters);
  const featuredItems = useMemo<FeaturedItem[]>(
    () => (showStrip && vipItems ? toFeaturedItems(vipItems) : []),
    [showStrip, vipItems],
  );

  // A listing shown in the strip must not ALSO be in the ordinary list.
  // Done after flattening the pages, so paging is untouched. With any
  // search/filter active featuredItems is empty and nothing is removed.
  const displayedItems = useMemo(() => {
    if (visualSearchResults) return visualSearchResults;
    return excludeFeatured(allItems, featuredItems);
  }, [allItems, featuredItems, visualSearchResults]);

  const hasActiveFilters =
    category !== "All" || !!itemType || !!locationType || !!city || !!dateFrom || !!dateTo;
  const clearSearchAndFilters = () => {
    setSearchValue("");
    setFilterParams({
      q: null, cat: null, type: null, loc: null, from: null, to: null, city: null,
    });
  };

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
          {/* Type selector: Lost or Found — a separate row, no swipe (few buttons).
              Moved ABOVE the category row (user request) — text-only pills, no
              icons, less rounded than before (rounded-md, not rounded-full). */}
          {!visualSearchResults && (
            <div className="flex flex-wrap items-center gap-1.5">
                {/* The color follows the same convention as the cards: found is green, lost is red.
                    When inactive the color is on the TEXT, when active it's on the
                    BACKGROUND — otherwise red text would end up on a green background. */}
                {(
                  [
                    { value: null, label: t("all"), on: "bg-emerald-500 text-white", off: "bg-[#f2f6fa] text-emerald-700 dark:bg-transparent dark:text-emerald-400" },
                    { value: "found", label: t("filterFound"), on: "bg-emerald-500 text-white", off: "bg-[#f2f6fa] text-emerald-700 dark:bg-transparent dark:text-emerald-400" },
                    { value: "lost", label: t("filterLost"), on: "bg-rose-500 text-white", off: "bg-[#f2f6fa] text-rose-700 dark:bg-transparent dark:text-rose-400" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value ?? "all"}
                    onClick={() => setItemType(opt.value)}
                    aria-pressed={itemType === opt.value}
                    className={cn(
                      "px-3 md:px-4 min-[1084px]:px-5 min-[1920px]:px-[22px] h-7 md:h-9 min-[1084px]:h-10 min-[1920px]:h-[42px] rounded-md font-medium text-[11px] min-[1084px]:text-xs min-[1920px]:text-[13px] tracking-wide flex items-center cursor-pointer transition-colors",
                      itemType === opt.value ? opt.on : opt.off,                    )}
                  >
                    {opt.label}
                  </button>
                ))}

                {/* Search — moved here from Header (user request): level with the
                    type filter pills, right after Lost/Found. flex-1 fills the
                    remaining space, pushing the date button to the right edge. */}
                <div className="relative flex-1 min-w-[120px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    ref={searchInputRef}
                    aria-label={t("search")}
                    inputMode="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    placeholder={t("search")}
                    className="pl-8 pr-9 h-7 md:h-9 min-[1084px]:h-10 min-[1920px]:h-[42px] rounded-md bg-white dark:bg-zinc-800 border border-emerald-500 dark:border-emerald-400 shadow-none focus-visible:ring-0 focus-visible:border-2 transition-all text-[11px] min-[1084px]:text-xs w-full"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter searches right away, skipping the debounce.
                      if (e.key === "Enter") commitSearch(searchValue);
                    }}
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {searchValue && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchValue("");
                          commitSearch("");
                          searchInputRef.current?.focus();
                        }}
                        aria-label={t("clearFilter") || "Тоза кардан"}
                        className="p-1 text-slate-400 hover:text-zinc-600 transition-colors cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => setShowPhotoChoice(true)}
                      className={cn(
                        "p-1 text-slate-400 hover:text-zinc-600 transition-colors cursor-pointer",
                        !aiEnabled && "hidden",
                      )}
                      title={t("visualSearchTitle") || "Ҷустуҷӯ бо акс"}
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Date range filter (From/To) — pushed to the right edge of the row (ml-auto) */}
                <div className="relative ml-auto mr-2" ref={datePickerRef}>
                  <button
                    type="button"
                    onClick={openDatePicker}
                    aria-label={t("filterTitle")}
                    className={cn(
                      "h-9 w-9 min-[1503px]:h-10 min-[1503px]:w-10 min-[1920px]:h-[42px] min-[1920px]:w-[42px] flex items-center justify-center rounded-md border cursor-pointer transition-colors",
                      dateFrom || dateTo || city
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white border-hairline dark:bg-zinc-800 text-slate-400",
                    )}
                  >
                    <SlidersHorizontal className="w-5 h-5 min-[1503px]:w-[22px] min-[1503px]:h-[22px]" />
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
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-md border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-800 shadow-[var(--shadow-3)] p-3 space-y-2.5">
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("filterTitle")}</h2>
                      {/* City — swipe sideways; "All" (default) = no city filter. Applies immediately. */}
                      <div className="-mx-3 px-3 flex gap-1.5 overflow-x-auto no-scrollbar snap-x">
                        {(["all", ...CITY_IDS] as const).map((id) => {
                          const on = id === "all" ? city === null : city === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setFilterParams({ city: id === "all" || on ? null : id })}
                              className={cn(
                                "shrink-0 snap-start h-8 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors",
                                on
                                  ? "bg-emerald-500 text-white"
                                  : "bg-[#f2f6fa] text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
                              )}
                            >
                              {id === "all" ? t("all") : cityLabel(id, locale)}
                            </button>
                          );
                        })}
                      </div>
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
                          className="text-[11px] font-medium text-slate-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                        >
                          {t("clearFilter")}
                        </button>
                        <button
                          type="button"
                          onClick={applyDateFilter}
                          className="px-3 h-8 rounded-md bg-emerald-500 text-white text-[11px] font-medium cursor-pointer"
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
          <div
            className={cn(
              "-mx-1 px-1 mt-0.5",
              visualSearchResults
                ? "flex items-center gap-1 overflow-x-auto no-scrollbar py-2.5 -my-2.5 w-full justify-end"
                : "flex items-center gap-1 overflow-x-auto no-scrollbar py-2.5 -my-2.5",
            )}
          >
              {visualSearchResults ? (
                // Floating bottom-right (above the mobile navbar) so it stays
                // visible and within thumb reach while scrolling results.
                <button
                  type="button"
                  onClick={() => setVisualSearchResults(null)}
                  className="fixed right-4 bottom-[calc(56px+16px+env(safe-area-inset-bottom))] md:bottom-6 z-[4000] flex items-center gap-2 h-12 px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  {t("clearResults")}
                </button>
              ) : (
                <>
                  <CategoryFilterCard
                    label={t("all")}
                    image={ALL_CATEGORY_FILTER_IMAGE}
                    transparent
                    active={category === "All"}
                    dimmed={category !== "All"}
                    onClick={() => setCategory("All")}
                  />
                  {CATEGORY_FILTER_ITEMS.map((cat) => (
                    <CategoryFilterCard
                      key={cat.id}
                      label={t(`categories.${cat.id}`)}
                      image={CATEGORY_FILTER_IMAGES[cat.name] ?? CATEGORY_IMAGES[cat.name]}
                      transparent={!!CATEGORY_FILTER_IMAGES[cat.name]}
                      wide={cat.name === "Electronics" || cat.name === "Clothing"}
                      active={category === cat.name}
                      dimmed={category !== "All" && category !== cat.name}
                      onClick={() => setCategory(cat.name)}
                    />
                  ))}
                </>
              )}
          </div>
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
            <div className="flex gap-1.5 overflow-x-auto snap-x snap-mandatory no-scrollbar py-5 -my-5 mr-[-10px] sm:mr-[-16px] lg:mr-[-20px]">
              {QUICK_ACTIONS.map(({ value, icon: Icon }) => {
                const active = value === "all" ? locationType === null : locationType === value;
                const title = t(`quickActions.${value}.title`);
                return (
                  <button
                    key={value}
                    onClick={() => (value === "all" ? setLocationType(null) : toggleLocationType(value))}
                    aria-pressed={active}
                    aria-label={title}
                    className={cn(
                      "shrink-0 snap-start w-max flex items-center justify-between gap-3 px-3 py-2.5 min-[1503px]:py-3.5 rounded-md text-left cursor-pointer transition-colors",
                      active ? "bg-emerald-500 text-white" : "bg-[#f2f6fa] text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-xs min-[1503px]:text-[13px] min-[1920px]:text-sm leading-tight tracking-wide whitespace-nowrap">
                        {title}
                      </span>
                      <span className="text-left font-medium text-[10px] min-[1503px]:text-[11px] min-[1920px]:text-xs leading-tight tracking-wide whitespace-nowrap opacity-70">
                        {t(`quickActions.${value}.desc`)}
                      </span>
                    </div>
                    <Icon
                      className={cn(
                        "w-8 h-8 min-[1503px]:w-9 min-[1503px]:h-9 min-[1920px]:w-10 min-[1920px]:h-10 shrink-0",
                        active ? "text-white" : "text-slate-500 dark:text-zinc-400",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* VIP/VVIP strip (get_vip_items). Renders nothing when empty. */}
        {showStrip && <FeaturedPeopleCarousel items={featuredItems} isLoading={false} />}

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
        ) : displayedItems.length > 0 || (allItems.length > 0 && !!hasNextPage) ? (
          // The second condition: a page made only of strip items must still
          // render the infinite-scroll sentinel so the next page loads.
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
              <p className="pb-6 text-center text-xs min-[1084px]:text-[13px] font-medium text-slate-400 dark:text-zinc-500">
                {isDefaultFilters ? t("endOfListAll") : t("endOfListFiltered")}
              </p>
            )}
          </>
        ) : isError && !isFetching && !visualSearchResults ? (
          <div
            role="alert"
            className="text-center py-20 bg-slate-50 dark:bg-zinc-800/50 rounded-md border-2 border-dashed border-slate-200 dark:border-zinc-800"
          >
            <h2 className="text-xl font-semibold tracking-tight">{t("feedLoadError")}</h2>
            <p className="text-slate-500 text-sm mt-2">{t("feedLoadErrorHint")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-4 rounded-md"
            >
              {t("feedRetry")}
            </Button>
          </div>
        ) : (
          <div className="text-center py-20 bg-slate-50 dark:bg-zinc-800/50 rounded-md border-2 border-dashed border-slate-200 dark:border-zinc-800">
            <h2 className="text-xl font-semibold tracking-tight flex items-center justify-center gap-1">
              {isLoading || isFetching || isSearchTyping ? (
                <>
                  {t("search")}
                  <span className="flex gap-1 items-center ml-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-duration:0.8s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-duration:0.8s] [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-duration:0.8s] [animation-delay:0.4s]"></span>
                  </span>
                </>
              ) : !visualSearchResults && searchQuery ? (
                <span className="break-words">{t("noResultsFor", { query: searchQuery })}</span>
              ) : (
                t("noItemsFound")
              )}
            </h2>
            {!(isLoading || isFetching || isSearchTyping) && (
              <p className="text-slate-500 text-sm mt-2">
                {!visualSearchResults && (searchQuery || hasActiveFilters)
                  ? t("noResultsHint")
                  : t("noItemsSubtitle")}
              </p>
            )}
            {!(isLoading || isFetching || isSearchTyping) &&
              !visualSearchResults &&
              (searchQuery || hasActiveFilters) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSearchAndFilters}
                  className="mt-4 rounded-md"
                >
                  {t("clearSearchAndFilters")}
                </Button>
              )}
          </div>
        )}
      </div>

      {/* Visual search — moved here from Header along with the text search box. */}
      <VisualSearchModal
        isOpen={isVisualSearchOpen}
        onClose={() => {
          setIsVisualSearchOpen(false);
          setDirectFile(null);
        }}
        onResults={handleVisualSearchResults}
        directFile={directFile}
      />

      <input
        type="file"
        className="hidden"
        accept="image/*"
        ref={galleryInputRef}
        onChange={handlePhotoPicked}
      />

      <Dialog open={showPhotoChoice} onOpenChange={setShowPhotoChoice}>
        <DialogContent
          overlayClassName="bg-black/50"
          showCloseButton={false}
          className="w-[min(20rem,calc(100vw-2rem))] max-w-none rounded-md border border-hairline dark:border-zinc-800 bg-white dark:bg-zinc-800 p-3 gap-2.5 shadow-[var(--shadow-3)] focus:ring-0 focus:outline-none"
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-left text-zinc-900 dark:text-zinc-100">
              {t("choose_photo_method")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="flex flex-col gap-2 h-24 rounded-md bg-white border border-hairline dark:bg-zinc-800 dark:border-zinc-700 group transition-all focus:ring-0 focus-visible:ring-0 outline-none shadow-none"
              onClick={() => {
                setShowPhotoChoice(false);
                setShowCameraCapture(true);
              }}
            >
              <div className="w-10 h-10 rounded-md bg-blue-500 flex items-center justify-center text-white transition-all">
                <Camera className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-medium tracking-wide text-slate-500">
                {t("camera")}
              </span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col gap-2 h-24 rounded-md bg-white border border-hairline dark:bg-zinc-800 dark:border-zinc-700 group transition-all focus:ring-0 focus-visible:ring-0 outline-none shadow-none"
              onClick={() => {
                setShowPhotoChoice(false);
                galleryInputRef.current?.click();
              }}
            >
              <div className="w-10 h-10 rounded-md bg-orange-500 flex items-center justify-center text-white transition-all">
                <ImageIcon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-medium tracking-wide text-slate-500">
                {t("gallery")}
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CameraCaptureModal
        isOpen={showCameraCapture}
        onClose={() => setShowCameraCapture(false)}
        onCapture={handleCameraCapture}
      />
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
