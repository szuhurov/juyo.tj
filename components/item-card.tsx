"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Item } from "@/lib/services/item-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { MapPin, Calendar, Eye, Bookmark } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { ItemService } from "@/lib/services/item-service";

export function ItemCard({ item }: { item: Item }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  
  const exactDate = format(new Date(item.created_at), "dd.MM.yyyy");

  const images = item.images && item.images.length > 0 
    ? item.images 
    : [{ image_url: "https://placehold.co/600x600/e2e8f0/64748b?text=JUYO" }];

  useEffect(() => {
    if (userId) {
      checkSavedStatus();
    }

    if (images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [images.length, item.id, userId]);

  const checkSavedStatus = async () => {
    if (!userId) return;
    
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) {
        console.warn("No Supabase token available");
        return;
      }
      
      const supabase = createClerkSupabaseClient(token);
      const { data, error } = await supabase
        .from('saved_items')
        .select('item_id')
        .eq('user_id', userId)
        .eq('item_id', item.id)
        .maybeSingle();
      
      if (error) {
        // If it's a 406 or other RLS error, log it clearly
        console.error("Supabase error in checkSavedStatus:", error.message, error.details, error.hint);
        throw error;
      }
      setIsSaved(!!data);
    } catch (e: any) {
      // Log the full error object or message
      console.error("Detailed error checking saved status:", e?.message || e);
      setIsSaved(false);
    }
  };

  const toggleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!userId) {
      toast.info("Лутфан аввал сабти ном кунед");
      router.push("/sign-up");
      return;
    }

    if (isToggling) return;

    setIsToggling(true);
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error("No token");
      
      const supabase = createClerkSupabaseClient(token);
      const saved = await ItemService.toggleSaveItem(supabase, userId!, item.id);
      setIsSaved(saved);
      toast.success(saved ? "Ба захирашудаҳо илова шуд" : "Аз захирашудаҳо нест шуд");
      
      // Dispatch event to update other components (like Saved Items page if open)
      window.dispatchEvent(new Event('saved-items-updated'));
    } catch (e) {
      console.error("Toggle save error:", e);
      toast.error(t('error'));
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Link href={`/items/${item.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow duration-300 group h-full rounded-xl border-zinc-200 dark:border-zinc-800">
        <div className="relative aspect-square overflow-hidden rounded-t-xl">
          {images.map((img, index) => (
            <Image
              key={index}
              src={img.image_url}
              alt={item.title}
              fill
              className={cn(
                "object-cover transition-all duration-700 ease-in-out group-hover:scale-105",
                index === currentImageIndex ? "opacity-100" : "opacity-0"
              )}
            />
          ))}
          <div className="absolute top-2 left-2 right-2 flex justify-between items-center">
            <Badge 
              className={cn(
                "uppercase font-black rounded-sm text-[9px] px-2 py-0.5 shadow-sm border-none",
                item.type === 'lost' 
                  ? "bg-red-600 text-white hover:bg-red-700" 
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              )}
            >
              {item.type === 'lost' ? t('lost') : t('found')}
            </Badge>
            
            {item.reward && (
              <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-500 font-black rounded-sm text-[9px] px-2 py-0.5 shadow-sm border-none">
                {t('reward')} {item.reward} TJS
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="p-3">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 font-bold text-[9px] bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded-[1px] uppercase tracking-wider">
                {t(`categories.${item.category}`)}
              </span>
              <div className="flex items-center gap-1 text-zinc-400 text-[9px]">
                <Eye className="w-3 h-3" />
                <span>{item.views || 0}</span>
              </div>
            </div>
            
            <h3 className="font-black text-xs line-clamp-1 leading-tight group-hover:text-emerald-500 transition-colors uppercase tracking-tight">
              {item.title}
            </h3>
            
            <p className="text-zinc-500 text-[10px] line-clamp-2 leading-tight">
              {item.description}
            </p>
          </div>
        </CardContent>
        <CardFooter className="px-3 pb-3 pt-0 flex justify-between items-center mt-auto">
          <div className="flex items-center justify-between text-zinc-400 text-[9px] font-bold uppercase tracking-wider border-t border-zinc-50 dark:border-zinc-900 pt-2 w-full">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-2.5 h-2.5" />
              <span>{exactDate}</span>
            </div>
            <button 
              onClick={toggleSave}
              disabled={isToggling}
              className={cn(
                "p-1 rounded-md transition-colors",
                isSaved ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "hover:text-emerald-600 hover:bg-emerald-50"
              )}
            >
              <Bookmark className={cn("w-3.5 h-3.5 transition-all", isSaved && "fill-emerald-500")} />
            </button>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
