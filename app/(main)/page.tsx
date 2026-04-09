"use client";

import { useState, Suspense } from "react";
import { ItemService, CATEGORIES } from "@/lib/services/item-service";
import { ItemCard } from "@/components/item-card";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";

function HomeContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || "";
  
  const [category, setCategory] = useState("All");
  const [itemType, setItemType] = useState<'lost' | 'found' | null>(null);

  // Use SWR for caching items
  const { data: items = [], isLoading } = useSWR(
    ['items', category, itemType, searchQuery],
    () => ItemService.getItems({ 
      category: category === "All" ? undefined : category,
      type: itemType || undefined,
      search: searchQuery
    }),
    {
      revalidateOnFocus: false, // Don't refetch when window gets focus
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  return (
    <div className="container mx-auto px-4 pb-8">
      {/* Filters Section - Sticky and Glued to Navbar */}
      <div className="sticky top-[63px] z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md -mx-4 px-4 md:mx-0 md:px-0 mb-2 pt-0 pb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Category Filters (Left) */}
          <div className="flex items-center overflow-x-auto no-scrollbar">
            <div className="flex bg-zinc-100/60 dark:bg-zinc-900/60 backdrop-blur-md p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
              <button
                onClick={() => setCategory("All")}
                className={cn(
                  "px-4 h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
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
                    "px-3 h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap",
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
          </div>

          {/* Lost/Found Toggle (Right) */}
          <div className="flex items-center self-end md:self-auto">
            <div className="flex bg-zinc-100/60 dark:bg-zinc-900/60 backdrop-blur-md p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
              <button
                onClick={() => setItemType(null)}
                className={cn(
                  "px-4 h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer",
                  itemType === null
                    ? "bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                )}
              >
                Ҳама
              </button>
              <button
                onClick={() => setItemType('lost')}
                className={cn(
                  "px-4 h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer",
                  itemType === 'lost'
                    ? "bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900"
                    : "text-red-500 hover:text-red-600"
                )}
              >
                Гумшудаҳо
              </button>
              <button
                onClick={() => setItemType('found')}
                className={cn(
                  "px-4 h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer",
                  itemType === 'found'
                    ? "bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900"
                    : "text-emerald-500 hover:text-emerald-600"
                )}
              >
                Ёфтшудаҳо
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item: any) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <h3 className="text-xl font-black mb-2 uppercase tracking-tight">{t('noItemsFound')}</h3>
          <p className="text-zinc-500 text-sm">{t('noItemsSubtitle')}</p>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-20 text-center"><Skeleton className="h-10 w-48 mx-auto" /></div>}>
      <HomeContent />
    </Suspense>
  );
}
