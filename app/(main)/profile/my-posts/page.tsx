/**
 * Ин саҳифаи эълонҳои шахсии корбар ҳаст (My Posts).
 * Дар ин ҷо танҳо ҳамон эълонҳое нишон дода мешаванд, ки худи корбар сохтааст.
 * Аз ин ҷо метавон эълонҳоро бинад ё онҳоро нест (удалить) кунад.
 */

"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react"; // Барои кор бо стейт ва эффектҳо
import { useAuth } from "@clerk/nextjs"; // Барои гирифтани маълумоти корбар
import { Item, ItemService } from "@/lib/services/item-service"; // Барои кор бо эълонҳо
import { ItemCard } from "@/components/item-card"; // Компоненти корти эълон
import { useLanguage } from "@/lib/language-context"; // Барои тарҷумаи забон
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Skeleton } from "@/components/ui/skeleton"; // Компоненти боргузорӣ
import { PackageSearch, Trash2 } from "lucide-react"; // Иконкаҳо
import Link from "next/link"; // Барои гузариш байни саҳифаҳо
import { toast } from "sonner"; // Барои хабарҳои кӯтоҳ
import { ITEM_GRID_CLASS } from "@/lib/ui-constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Барои тирезаҳои огоҳӣ

export default function MyPostsPage() {
  // Хукҳо барои аутентификатсия ва тарҷумаи забон
  const { userId } = useAuth();
  const { t } = useLanguage();
  
  // Стейтҳо барои нигоҳ доштани рӯйхати эълонҳо ва ҳолати боргузорӣ (Loading)
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Стейтҳо барои идоракунии несткунии эълон
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  /**
   * Функсия барои гирифтани эълонҳои шахсӣ аз база
   */
  const loadMyItems = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await ItemService.getItems({ user_id: userId });
      setItems(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Вақте саҳифа кушода мешавад, эълонҳои корбарро аз база мехонем
  useEffect(() => {
    if (userId) loadMyItems();

    // Агар дар ягон ҷо эълонҳо нав шаванд, рӯйхатро нав мекунем
    const handleUpdate = () => {
      if (userId) loadMyItems();
    };
    window.addEventListener('items-updated', handleUpdate);
    return () => {
      window.removeEventListener('items-updated', handleUpdate);
    };
  }, [userId, loadMyItems]);

  // Санҷиши AI дар сервер async аст (trigger_image_moderation, чанд сония
  // мегирад) — то он тамом шавад, эълон "pending" мемонад. Бе ин polling,
  // корбар "Дар ҳоли санҷиш"-ро то reload-и дастӣ мебинад, ҳатто агар
  // сервер аллакай онро тасдиқ карда бошад.
  useEffect(() => {
    if (!items.some((item) => item.moderation_status === "pending")) return;
    const interval = setInterval(loadMyItems, 3000);
    return () => clearInterval(interval);
  }, [items, loadMyItems]);

  /**
   * Функсия барои нест кардани эълон (Delete)
   */
  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/items/${itemToDelete}/delete`, { method: 'POST' });
      if (!res.ok) throw new Error();

      // Рӯйхати эълонҳоро дар экран нав мекунем (Optimistic UI)
      setItems(prev => prev.filter(item => item.id !== itemToDelete));
      toast.success(t('success'));
    } catch {
      toast.error(t('error'));
    } finally {
      setIsActionLoading(false);
      setItemToDelete(null);
    }
  };

  return (
    <div className="w-full px-2 sm:px-4 py-8">
      {/* Сарлавҳаи саҳифа */}
      <div className="flex items-center gap-4 mb-8 px-2 sm:px-0">
        <h1 className="text-2xl min-[1084px]:text-3xl min-[1920px]:text-[32px] font-black tracking-tight">{t('myPosts')}</h1>
      </div>

      {loading ? (
        /* Намоиши скелетон ҳангоми боргузории маълумот */
        <div className={ITEM_GRID_CLASS}>
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      ) : items.length > 0 ? (
        /* Рендеринги рӯйхати эълонҳои ман */
        <div className={ITEM_GRID_CLASS} style={{ contentVisibility: 'auto' } as CSSProperties}>
          {items.map((item) => (
            <div key={item.id} className="relative group">
              <ItemCard item={item} />
              {/* Тугмаи нест кардан дар болои корт */}
              <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex gap-2">
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8 min-[1084px]:h-9 min-[1084px]:w-9 min-[1920px]:h-10 min-[1920px]:w-10 rounded-lg shadow-lg bg-red-600/90 backdrop-blur-sm border-none"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setItemToDelete(item.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1920px]:w-5 min-[1920px]:h-5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Агар ягон эълон набошад */
        <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <PackageSearch className="w-16 h-16 min-[1084px]:w-20 min-[1084px]:h-20 min-[1920px]:w-24 min-[1920px]:h-24 text-zinc-300 mx-auto mb-4" />
          <h2 className="text-xl min-[1084px]:text-2xl min-[1920px]:text-[28px] font-bold mb-2">{t('noItemsFound')}</h2>
          <Button asChild className="rounded-md font-bold text-xs min-[1084px]:text-sm min-[1920px]:text-base min-[1084px]:h-10 min-[1920px]:h-11 min-[1084px]:px-5 min-[1920px]:px-6">
            <Link href="/items/add">{t('addItemTitle')}</Link>
          </Button>
        </div>
      )}

      {/* Тирезаи тасдиқ барои нест кардани эълон (Confirm Dialog) */}
      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight text-red-600">{t('deleteConfirmTitle')}</DialogTitle>
            <DialogDescription className="font-medium pt-2">{t('deletePostConfirm')}</DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-xl font-bold text-xs h-12" onClick={() => setItemToDelete(null)}>{t('cancel')}</Button>
            <Button variant="destructive" className="flex-1 rounded-xl font-bold text-xs h-12 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={isActionLoading}>{t('delete')}</Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
