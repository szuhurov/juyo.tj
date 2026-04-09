"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Item, ItemService } from "@/lib/services/item-service";
import { ItemCard } from "@/components/item-card";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, PackageSearch } from "lucide-react";
import Link from "next/link";

export default function MyPostsPage() {
  const { userId } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) loadMyItems();
  }, [userId]);

  const loadMyItems = async () => {
    try {
      // Assuming ItemService has a method to get user's items
      // If not, we'll need to implement it in item-service.ts
      const data = await ItemService.getItems({ user_id: userId });
      setItems(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
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
          {items.map((item) => <ItemCard key={item.id} item={item} />)}
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
    </div>
  );
}
