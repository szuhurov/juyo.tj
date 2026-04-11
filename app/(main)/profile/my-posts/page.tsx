"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Item, ItemService } from "@/lib/services/item-service";
import { ItemCard } from "@/components/item-card";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, PackageSearch, Trash2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { createClerkSupabaseClient } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function MyPostsPage() {
  const { userId, getToken } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (userId) loadMyItems();
    
    const handleUpdate = () => {
      if (userId) loadMyItems();
    };
    window.addEventListener('items-updated', handleUpdate);
    return () => {
      window.removeEventListener('items-updated', handleUpdate);
    };
  }, [userId]);

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

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsActionLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      await ItemService.deleteItem(supabase, itemToDelete);
      
      // Optimistic update: remove from local state immediately
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
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/profile"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <h1 className="text-2xl font-black uppercase tracking-tight">{t('myPosts')}</h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="relative group">
              <ItemCard item={item} />
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
        <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <PackageSearch className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{t('noItemsFound')}</h2>
          <Button asChild className="rounded-md font-bold uppercase text-xs">
            <Link href="/items/add">{t('addItemTitle')}</Link>
          </Button>
        </div>
      )}

      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-red-600">{t('deleteConfirmTitle')}</DialogTitle>
            <DialogDescription className="font-medium pt-2">{t('deletePostConfirm')}</DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-xl font-bold uppercase text-xs h-12" onClick={() => setItemToDelete(null)}>{t('cancel')}</Button>
            <Button variant="destructive" className="flex-1 rounded-xl font-bold uppercase text-xs h-12 bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={isActionLoading}>{t('delete')}</Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
