/**
 * Ин саҳифаи асосии мост (Главная).
 * Дар ин ҷо ҳамаи эълонҳо нишон дода мешаванд. Одамон метавонанд аз рӯи категорияҳо филтр кунанд
 * ё ҷустуҷӯ кунанд, то чизҳои гумшуда ё ёфтшударо пайдо намоянд.
 */

"use client";

import { useState, Suspense, useEffect, useMemo } from "react"; 
import { ItemService, CATEGORIES } from "@/lib/services/item-service"; 
import { ItemCard } from "@/components/item-card"; 
import { useLanguage } from "@/lib/language-context"; 
import { cn } from "@/lib/utils"; 
import { Skeleton } from "@/components/ui/skeleton"; 
import { useSearchParams } from "next/navigation"; 
import { useItems } from "@/lib/hooks/use-items"; 
import { useQueryClient } from "@tanstack/react-query"; 
import { useInView } from "react-intersection-observer";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function HomeContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || "";
  const queryClient = useQueryClient();
  const { ref, inView } = useInView();
  
  const [category, setCategory] = useState("All");
  const [itemType, setItemType] = useState<'lost' | 'found' | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [visualSearchResults, setVisualSearchResults] = useState<any[] | null>(null);

  const filters = useMemo(() => ({ 
    category: category === "All" ? undefined : category,
    type: itemType || undefined,
    search: searchQuery
  }), [category, itemType, searchQuery]);

  const { 
    data, 
    isLoading, 
    isFetching, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useItems(filters);

  // Боркунии саҳифаи навбатӣ ҳангоми расидан ба охири рӯйхат
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    };
    
    // Логика барои хабардор шудан аз ҷустуҷӯ
    const handleSearchActive = (e: any) => {
      setIsTyping(e.detail);
    };

    const handleVisualResults = (e: any) => {
      setVisualSearchResults(e.detail);
      // Вақте ҷустуҷӯи визуалӣ мешавад, филтрҳои дигарро тоза мекунем
      setCategory("All");
      setItemType(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleHomeClick = () => {
      setVisualSearchResults(null);
      setCategory("All");
      setItemType(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('items-updated', handleUpdate);
    window.addEventListener('saved-items-updated', handleUpdate);
    window.addEventListener('search-active', handleSearchActive);
    window.addEventListener('visual-search-results', handleVisualResults);
    window.addEventListener('go-home', handleHomeClick);
    
    return () => {
      window.removeEventListener('items-updated', handleUpdate);
      window.removeEventListener('saved-items-updated', handleUpdate);
      window.removeEventListener('search-active', handleSearchActive);
      window.removeEventListener('visual-search-results', handleVisualResults);
      window.removeEventListener('go-home', handleHomeClick);
    };
  }, [queryClient]);

  // Ҷамъоварии ҳамаи ашёҳо аз ҳамаи саҳифаҳо
  const allItems = useMemo(() => {
    return data?.pages.flatMap(page => page) || [];
  }, [data]);

  // Усули "Pro": Намоиши ашёҳо бидуни филтри зиёдатии фронтенд (чун backend аллакай филтр мекунад)
  const displayedItems = useMemo(() => {
    if (visualSearchResults) return visualSearchResults;
    return allItems;
  }, [allItems, visualSearchResults]);

  return (
    <div className="pb-18">
      {/* Қисмати Филтрҳо (Header/Filters) */}
      <div className="fixed top-12 sm:top-16 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-100 dark:border-zinc-900">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 pt-1 pb-1.5 sm:py-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-1.5 md:gap-1 md:h-14">
            {/* Кнопкаҳои категорияҳо */}
            <div className={cn(
              "flex items-center overflow-x-auto no-scrollbar -mx-1 px-1",
              visualSearchResults && "w-full justify-end"
            )}>
              {visualSearchResults ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setVisualSearchResults(null)}
                  className="rounded-xl h-8 text-[10px] font-black uppercase tracking-widest border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400"
                >
                  <X className="h-3.5 w-3.5 mr-2" />
                  {t('clearResults')}
                </Button>
              ) : (
                <div className="flex bg-zinc-100/60 dark:bg-zinc-900/60 p-0.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
                  <button
                    onClick={() => setCategory("All")}
                    className={cn(
                      "px-3 md:px-4 h-7 md:h-9 rounded-lg font-bold text-[10px] md:text-[11px] uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
                      category === "All"
                        ? "bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    )}
                  >
                    {t('all')}
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.name)}
                      className={cn(
                        "px-3 md:px-4 h-7 md:h-9 rounded-lg font-bold text-[10px] md:text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap",
                        category === cat.name
                          ? "bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900"
                          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                      )}
                    >
                      <span className="text-xs">{cat.icon}</span>
                      {t(`categories.${cat.id}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Интихоби навъ: Гумшуда ё Ёфтшуда */}
            {!visualSearchResults && (
              <div className="flex items-center self-end md:self-auto mb-0.5 md:mb-0">
                <div className="flex bg-zinc-100/60 dark:bg-zinc-900/60 p-0.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
                  <button
                    onClick={() => setItemType(null)}
                    className={cn(
                      "px-3 md:px-4 h-7 md:h-9 rounded-lg font-bold text-[10px] md:text-[11px] uppercase tracking-wider transition-all cursor-pointer",
                      itemType === null
                        ? "bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    )}
                  >
                    {t('all')}
                  </button>
                  <button
                    onClick={() => setItemType('lost')}
                    className={cn(
                      "px-3 md:px-4 h-7 md:h-9 rounded-lg font-bold text-[10px] md:text-[11px] uppercase tracking-wider transition-all cursor-pointer",
                      itemType === 'lost'
                        ? "bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900"
                        : "text-red-500 hover:text-red-600"
                    )}
                  >
                    {t('filterLost')}
                  </button>
                  <button
                    onClick={() => setItemType('found')}
                    className={cn(
                      "px-3 md:px-4 h-7 md:h-9 rounded-lg font-bold text-[10px] md:text-[11px] uppercase tracking-wider transition-all cursor-pointer",
                      itemType === 'found'
                        ? "bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900"
                        : "text-emerald-500 hover:text-emerald-600"
                    )}
                  >
                    {t('filterFound')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Мӯҳтавои асосиӣ: Рӯйхати эълонҳо */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 pt-[86px] md:pt-[65px] touch-pan-y">
        {isLoading && allItems.length === 0 && !searchQuery && category === "All" && itemType === null && !isTyping ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : displayedItems.length > 0 ? (
          <>
            {/* Версияи Desktop ва Mobile: Рӯйхати умумӣ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-3">
              {displayedItems.map((item, index) => (
                <ItemCard key={item.id} item={item} index={index} />
              ))}
            </div>

            {/* Элемент барои Infinite Scroll */}
            <div ref={ref} className="h-10 mt-4 flex items-center justify-center">
              {isFetchingNextPage && (
                <div className="flex gap-1.5 items-center">
                  <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce [animation-duration:0.8s]"></span>
                  <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce [animation-duration:0.8s] [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce [animation-duration:0.8s] [animation-delay:0.4s]"></span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xl font-black uppercase tracking-tight flex items-center justify-center gap-1">
              {(isLoading || isFetching || isTyping) ? (
                <>
                  {t('search')}
                  <span className="flex gap-1 items-center ml-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-duration:0.8s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-duration:0.8s] [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-duration:0.8s] [animation-delay:0.4s]"></span>
                  </span>
                </>
              ) : t('noItemsFound')}
            </h3>
            {!(isLoading || isFetching || isTyping) && (
              <p className="text-zinc-500 text-sm mt-2">
                {t('noItemsSubtitle')}
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
    <div className="max-w-[1600px] mx-auto px-3 sm:px-4 pt-[86px] md:pt-[65px]">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
