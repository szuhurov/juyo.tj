/**
 * Ин саҳифаи эълонҳои шахсии корбар ҳаст (My Posts).
 * Дар ин ҷо танҳо ҳамон эълонҳое нишон дода мешаванд, ки худи корбар сохтааст.
 * Аз ин ҷо метавон эълонҳоро бинад ё онҳоро нест (удалить) кунад.
 */

"use client";

import { useEffect, useState } from "react"; // Барои кор бо стейт ва эффектҳо
import { useAuth } from "@clerk/nextjs"; // Барои гирифтани маълумоти корбар
import { Item, ItemService } from "@/lib/services/item-service"; // Барои кор бо эълонҳо
import { ItemCard } from "@/components/item-card"; // Компоненти корти эълон
import { useLanguage } from "@/lib/language-context"; // Барои тарҷумаи забон
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Skeleton } from "@/components/ui/skeleton"; // Компоненти боргузорӣ
import { ArrowLeft, PackageSearch, Trash2, CheckCircle2 } from "lucide-react"; // Иконкаҳо
import Link from "next/link"; // Барои гузариш байни саҳифаҳо
import { toast } from "sonner"; // Барои хабарҳои кӯтоҳ
import { createClerkSupabaseClient } from "@/lib/supabase"; // Барои пайваст шудан ба база
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Барои тирезаҳои огоҳӣ

export default function MyPostsPage() {
  // Хукҳо барои аутентификатсия ва тарҷумаи забон
  const { userId, getToken } = useAuth();
  const { t } = useLanguage();
  
  // Стейтҳо барои нигоҳ доштани рӯйхати эълонҳо ва ҳолати боргузорӣ (Loading)
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Стейтҳо барои идоракунии несткунии эълон
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

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
  }, [userId]);

  /**
   * Функсия барои гирифтани эълонҳои шахсӣ аз база
   */
  const loadMyItems = async () => {
    if (!userId) return;
    try {
      const data = await ItemService.getItems({ user_id: userId });
      setItems(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Функсия барои нест кардани эълон (Delete)
   */
  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsActionLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      await ItemService.deleteItem(supabase, itemToDelete);
      
      // Рӯйхати эълонҳоро дар экран нав мекунем (Optimistic UI)
      setItems(prev => prev.filter(item => item.id !== itemToDelete));
      toast.success(t('success'));
    } catch (error) {
      toast.error(t('error'));
    } finally {
      setIsActionLoading(false);
      setItemToDelete(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Сарлавҳаи саҳифа ва тугмаи "Назад" */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/profile"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <h1 className="text-2xl font-black uppercase tracking-tight">{t('myPosts')}</h1>
      </div>

      {loading ? (
        /* Намоиши скелетон ҳангоми боргузории маълумот */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      ) : items.length > 0 ? (
        /* Рендеринги рӯйхати эълонҳои ман */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="relative group">
              <ItemCard item={item} />
              {/* Тугмаи нест кардан дар болои корт */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg shadow-lg"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setItemToDelete(item.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Агар ягон эълон набошад */
        <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <PackageSearch className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{t('noItemsFound')}</h2>
          <Button asChild className="rounded-md font-bold uppercase text-xs">
            <Link href="/items/add">{t('addItemTitle')}</Link>
          </Button>
        </div>
      )}

      {/* Тирезаи тасдиқ барои нест кардани эълон (Confirm Dialog) */}
      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-red-600">{t('deleteConfirmTitle')}</DialogTitle>
            <DialogDescription className="font-medium pt-2">{t('deletePostConfirm')}</DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-xl font-bold uppercase text-xs h-12" onClick={() => setItemToDelete(null)}>{t('cancel')}</Button>
            <Button variant="destructive" className="flex-1 rounded-xl font-bold uppercase text-xs h-12 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={isActionLoading}>{t('delete')}</Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
