/**
 * Ин саҳифаи асосии мост (Главная).
 * Дар ин ҷо ҳамаи эълонҳо нишон дода мешаванд. Одамон метавонанд аз рӯи категорияҳо филтр кунанд
 * ё ҷустуҷӯ кунанд, то чизҳои гумшуда ё ёфтшударо пайдо намоянд.
 */

"use client";

import { useState, Suspense, useEffect } from "react"; // Барои кор бо ҳолатҳо ва вақт дар экран
import { ItemService, CATEGORIES } from "@/lib/services/item-service"; // Барои гирифтани маълумоти эълонҳо ва категорияҳо
import { ItemCard } from "@/components/item-card"; // Барои нишон додани ҳар як эълон дар алоҳидагӣ
import { useLanguage } from "@/lib/language-context"; // Барои иваз кардани забони сайт
import { cn } from "@/lib/utils"; // Барои якҷоя кардани классҳои CSS
import { Skeleton } from "@/components/ui/skeleton"; // Барои нишон додани ҳолати боргирӣ (загрузка)
import { useSearchParams, useRouter } from "next/navigation"; // Барои кор бо адрес ва параметрҳои URL
import { useItems } from "@/lib/hooks/use-items"; // Хуки махсус барои гирифтани рӯйхати эълонҳо
import { useQueryClient } from "@tanstack/react-query"; // Барои идора кардани кэши маълумотҳо
import { Input } from "@/components/ui/input"; // Компоненти майдони воридкунии матн
import { Search, X } from "lucide-react"; // Иконкаҳои ҷустуҷӯ ва нест кардан

function HomeContent() {
  // Хукҳо барои забон, роутинг ва параметрҳои URL
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || "";
  const queryClient = useQueryClient();
  
  // Стейтҳо барои ҷустуҷӯ, интихоби категория ва навъи эълон (гумшуда/ёфтшуда)
  const [searchValue, setSearchValue] = useState(searchQuery);
  const [category, setCategory] = useState("All");
  const [itemType, setItemType] = useState<'lost' | 'found' | null>(null);

  // Вақте ки дар URL ҷустуҷӯ иваз мешавад, стейти моро нав мекунад
  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);

  // Логикаи ҷустуҷӯ бо таъхир (Debounce), то ки серверро зиёд запрос нафиристем
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (searchValue) {
        params.set('q', searchValue);
      } else {
        params.delete('q');
      }
      router.push(`/?${params.toString()}`);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchValue]);

  // Агар дар ягон ҷои дигар эълонҳо нав шаванд, ин ҷо ҳам кэшро нав мекунем
  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    };
    window.addEventListener('items-updated', handleUpdate);
    window.addEventListener('saved-items-updated', handleUpdate);
    return () => {
      window.removeEventListener('items-updated', handleUpdate);
      window.removeEventListener('saved-items-updated', handleUpdate);
    };
  }, [queryClient]);

  // Запрос ба база барои гирифтани рӯйхати эълонҳо
  const { data: items = [], isLoading, isPlaceholderData } = useItems({ 
    category: category === "All" ? undefined : category,
    type: itemType || undefined,
    search: searchQuery
  });

  return (
    <div className="pb-18">
      {/* Қисмати Филтрҳо ва Ҷустуҷӯ (Header/Filters) */}
      <div className="fixed top-14 sm:top-16 left-0 right-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-900">
        <div className="container mx-auto px-4 pb-1.5 pt-0">
          {/* Поиск барои мобилка */}
          <div className="md:hidden relative mb-3 mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder={t('search')}
              className="pl-9 h-11 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/80 border-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 transition-all text-base"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            {searchValue && (
              <button 
                onClick={() => setSearchValue("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3 mt-3 md:mt-0 md:mb-2">
            {/* Кнопкаҳои категорияҳо */}
            <div className="flex items-center overflow-x-auto no-scrollbar -mx-1 px-1">
              <div className="flex bg-zinc-100/60 dark:bg-zinc-900/60 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
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

            {/* Интихоби навъ: Гумшуда ё Ёфтшуда */}
            <div className="flex items-center self-end md:self-auto">
              <div className="flex bg-zinc-100/60 dark:bg-zinc-900/60 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
                <button
                  onClick={() => setItemType(null)}
                  className={cn(
                    "px-4 h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer",
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
                    "px-4 h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer",
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
                    "px-4 h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer",
                    itemType === 'found'
                      ? "bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900"
                      : "text-emerald-500 hover:text-emerald-600"
                  )}
                >
                  {t('filterFound')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Мӯҳтавои асосӣ: Рӯйхати эълонҳо (Main Content / Grid) */}
      <div className="container mx-auto px-4 pt-[195px] md:pt-[70px]">
        {isLoading && items.length === 0 ? (
        /* Вақте ки маълумот бор шуда истодааст (Loading state) */
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        /* Намоиши эълонҳо дар сетка */
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {items.map((item: any) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        /* Агар ягон чиз ёфт нашуд */
        <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <h3 className="text-xl font-black mb-2 uppercase tracking-tight">{t('noItemsFound')}</h3>
          <p className="text-zinc-500 text-sm">{t('noItemsSubtitle')}</p>
        </div>
      )}
    </div>
    </div>
  );
}

/**
 * Компоненти асосии HomePage
 */
export default function HomePage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-20 text-center"><Skeleton className="h-10 w-48 mx-auto" /></div>}>
      <HomeContent />
    </Suspense>
  );
}
