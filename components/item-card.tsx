"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Item } from "@/lib/services/item-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { MapPin, Calendar, Eye, Bookmark, Pencil, Archive, Trash2, Share2, Loader2, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { ItemService } from "@/lib/services/item-service";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ItemCard({ item }: { item: Item }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  
  const isOwner = userId === item.user_id;
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
      if (!token) return;
      
      const supabase = createClerkSupabaseClient(token);
      const { data, error } = await supabase
        .from('saved_items')
        .select('item_id')
        .eq('user_id', userId)
        .eq('item_id', item.id)
        .maybeSingle();
      
      if (error) throw error;
      setIsSaved(!!data);
    } catch (e: any) {
      console.error("Error checking saved status:", e);
      setIsSaved(false);
    }
  };

  const toggleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!userId) {
      toast.info(t('pleaseLogin'));
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
      toast.success(saved ? t('addedToSaved') : t('removedFromSaved'));
      
      window.dispatchEvent(new Event('saved-items-updated'));
    } catch (e) {
      console.error("Toggle save error:", e);
      toast.error(t('error'));
    } finally {
      setIsToggling(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/items/${item.id}`;
    if (navigator.share) {
      navigator.share({
        title: item.title,
        text: item.description,
        url: url,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      toast.success(t('success'));
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/items/${item.id}/edit`);
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowArchiveConfirm(true);
  };

  const confirmArchive = async () => {
    if (isActionLoading) return;
    
    setIsActionLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      await ItemService.archiveToSafetyBox(supabase, item, userId!);
      toast.success(t('moveToSafeSuccess'));
      setShowArchiveConfirm(false);
      router.push('/profile?tab=safety');
      window.dispatchEvent(new Event('items-updated'));
    } catch (error) {
      toast.error(t('error'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (isActionLoading) return;
    
    setIsActionLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      await ItemService.deleteItem(supabase, item.id);
      toast.success(t('success'));
      setShowDeleteConfirm(false);
      window.dispatchEvent(new Event('items-updated'));
    } catch (error) {
      toast.error(t('error'));
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <>
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
            {/* Status Badge (Top-Left) */}
            <div className="absolute top-2 left-2 z-10">
              <Badge 
                className={cn(
                  "uppercase font-black rounded-md text-[10px] px-2.5 py-1 shadow-lg border-none",
                  item.type === 'lost' 
                    ? "bg-red-600 text-white hover:bg-red-700" 
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                )}
              >
                {item.type === 'lost' ? t('lost') : t('found')}
              </Badge>
            </div>

            {/* Reward Badge */}
            {item.reward && (
              <div className="absolute max-[600px]:bottom-2 max-[600px]:right-2 min-[601px]:top-2 min-[601px]:right-2 z-10">
                <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-500 font-black rounded-md text-[10px] px-2.5 py-1 shadow-lg border-none whitespace-nowrap">
                  {item.type === 'lost' ? t('reward_gives_viewer') : t('reward_wants_viewer')} {item.reward} TJS
                </Badge>
              </div>
            )}
          </div>
          <CardContent className="p-3 pb-2">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <h3 className="font-black text-xs line-clamp-1 leading-tight group-hover:text-emerald-500 transition-colors uppercase tracking-tight flex-1">
                  {item.title}
                </h3>
                <div className="flex items-center gap-1 text-zinc-400 text-[9px] ml-2 shrink-0">
                  <Eye className="w-3 h-3" />
                  <span>{item.views || 0}</span>
                </div>
              </div>
              
              <p className="text-zinc-500 text-[10px] line-clamp-2 leading-tight">
                {item.description}
              </p>
            </div>
          </CardContent>
          <CardFooter className="px-3 pb-3 pt-0 flex flex-col mt-auto">
            <div className="flex items-center justify-between text-zinc-400 text-[9px] font-bold uppercase tracking-wider border-t border-zinc-50 dark:border-zinc-900 pt-2 w-full mb-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-2.5 h-2.5" />
                <span>{exactDate}</span>
              </div>
              
              <div className="flex items-center gap-1.5">
                {isActionLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                ) : (
                  <>
                    {isOwner && (
                      <>
                        <button onClick={handleEdit} className="p-1 rounded-md hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={handleArchiveClick} className="p-1 rounded-md hover:text-amber-600 hover:bg-amber-50 transition-colors">
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={handleDelete} className="p-1 rounded-md hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button onClick={handleShare} className="p-1 rounded-md hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
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
                  </>
                )}
              </div>
            </div>
          </CardFooter>
        </Card>
      </Link>

      <Dialog open={showDeleteConfirm} onOpenChange={(open) => !isActionLoading && setShowDeleteConfirm(open)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-8 gap-6 border-none shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-2 bg-red-50 dark:bg-red-900/20 text-red-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">{t('deleteConfirmTitle') || t('delete')}</DialogTitle>
            <DialogDescription className="text-zinc-500 font-medium text-sm leading-relaxed">
              {t('deleteConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:justify-start pt-2">
            <Button 
              type="button" 
              variant="destructive"
              className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] text-white"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                confirmDelete();
              }}
              disabled={isActionLoading}
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('delete')}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] border-zinc-200"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeleteConfirm(false);
              }}
              disabled={isActionLoading}
            >
              {t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showArchiveConfirm} onOpenChange={(open) => !isActionLoading && setShowArchiveConfirm(open)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-8 gap-6 border-none shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600">
              <Archive className="w-6 h-6" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-amber-600">{t('moveToSafe')}</DialogTitle>
            <DialogDescription className="text-zinc-500 font-medium text-sm leading-relaxed">
              {t('moveToSafeDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:justify-start pt-2">
            <Button 
              type="button" 
              className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] bg-amber-600 hover:bg-amber-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                confirmArchive();
              }}
              disabled={isActionLoading}
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('confirm')}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] border-zinc-200"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowArchiveConfirm(false);
              }}
              disabled={isActionLoading}
            >
              {t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
