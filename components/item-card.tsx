"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Item } from "@/lib/services/item-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { MapPin, Calendar, Eye, Bookmark, Pencil, Archive, Trash2, Share2, Loader2, AlertTriangle, ShieldAlert, Clock, AlertCircle } from "lucide-react";
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
  const [showBlockedInfo, setShowBlockedInfo] = useState(false);
  
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (isOwner && item.moderation_status === 'rejected') {
      // Show modal but don't prevent navigation
      setShowBlockedInfo(true);
    }
  };

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

    // Optimistic Update
    const previousSavedState = isSaved;
    const newSavedState = !previousSavedState;
    
    setIsSaved(newSavedState);
    toast.success(newSavedState ? t('addedToSaved') : t('removedFromSaved'));
    
    // Background task
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error("No token");
      
      const supabase = createClerkSupabaseClient(token);
      const saved = await ItemService.toggleSaveItem(supabase, userId!, item.id);
      
      // Sync with actual result just in case, though it should match newSavedState
      if (saved !== newSavedState) {
        setIsSaved(saved);
      }
      
      window.dispatchEvent(new Event('saved-items-updated'));
    } catch (e) {
      console.error("Toggle save error:", e);
      // Revert on error
      setIsSaved(previousSavedState);
      toast.error(t('error'));
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isActionLoading) return;
    
    const url = `${window.location.origin}/items/${item.id}`;
    
    if (navigator.share) {
      try {
        setIsActionLoading(true);
        await navigator.share({
          title: item.title,
          text: item.description,
          url: url,
        });
      } catch (error: any) {
        // AbortError is normal if user cancels, others we just log
        if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
          console.error("Share error:", error);
          // Fallback to clipboard if share fails
          navigator.clipboard.writeText(url);
          toast.success(t('success'));
        }
      } finally {
        setIsActionLoading(false);
      }
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
      <div onClick={handleCardClick} className="h-full">
        <Link href={`/items/${item.id}`}>
          <Card className={cn(
            "overflow-hidden hover:shadow-md transition-shadow duration-300 group h-full rounded-xl border-zinc-200 dark:border-zinc-800",
            item.moderation_status === 'rejected' && isOwner && "opacity-75 grayscale-[0.5]"
          )}>
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
              {/* Status Badge (Top-Left) - Closer to edge for mobile */}
              <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 h-6 flex items-center">
                <Badge
                  className={cn(
                    "uppercase font-black rounded-md text-[10px] px-2.5 py-1 shadow-lg border-none whitespace-nowrap",
                    item.type === 'lost'
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  )}
                >
                  {item.type === 'lost' ? t('lost') : t('found')}
                </Badge>
              </div>

              {/* Mobile Save Button (Top-Right) */}
              <div className="absolute top-2 right-2 z-10 sm:hidden">
                <button 
                  onClick={(e) => {
                    toggleSave(e);
                  }}
                  disabled={isToggling}
                  className={cn(
                    "p-1.5 rounded-full backdrop-blur-md transition-all shadow-md",
                    isSaved 
                      ? "bg-emerald-500 text-white" 
                      : "bg-black/20 text-white hover:bg-black/40"
                  )}
                >
                  <Bookmark className={cn("w-3.5 h-3.5", isSaved && "fill-current")} />
                </button>
              </div>

              {/* Reward Badge - Only for Lost items - Closer to edge for mobile */}
              {item.type === 'lost' && item.reward && (
                <div className="absolute bottom-2 right-2 sm:top-3 sm:right-3 z-10 h-6 flex items-center justify-end">
                  <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-500 font-black rounded-md text-[10px] px-2.5 py-1 shadow-lg border-none whitespace-nowrap">
                    {t('reward_gives_viewer')} {item.reward} TJS
                  </Badge>
                </div>
              )}
              {/* Pending Overlay for Owner */}
              {isOwner && item.moderation_status === 'pending' && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 z-20">
                  <div className="bg-white/90 dark:bg-zinc-900/90 p-4 rounded-2xl shadow-2xl flex flex-col items-center text-center gap-3 animate-pulse">
                    <Clock className="w-8 h-8 text-amber-500" />
                    <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">
                      {t('imageModeration.pending')}
                    </span>
                  </div>
                </div>
              )}

              {/* Rejected Overlay for Owner */}
              {isOwner && item.moderation_status === 'rejected' && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 z-20">
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-2xl flex flex-col items-center text-center gap-3">
                    <ShieldAlert className="w-8 h-8 text-red-600" />
                    <span className="text-[10px] font-black uppercase text-red-600 tracking-wider">
                      {t('imageModeration.rejected')}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <CardContent className="p-3 pb-1">
              <div className="flex flex-col gap-0.5">
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
            <CardFooter className="px-3 pb-3  flex flex-col mt-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-zinc-400 text-[9px] font-bold uppercase tracking-wider border-t border-zinc-50 dark:border-zinc-900 pt-1.5 w-full gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-2.5 h-2.5" />
                  <span>{exactDate}</span>
                </div>
                
                <div className="hidden sm:flex items-center gap-1 sm:gap-1.5 self-stretch sm:self-auto justify-between sm:justify-end bg-zinc-50/50 dark:bg-zinc-900/50 p-1 sm:p-0 rounded-lg sm:bg-transparent">
                  {isActionLoading ? (
                    <div className="w-full flex justify-center py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        {isOwner && (
                          <>
                            <button onClick={handleEdit} className="p-1.5 rounded-md hover:text-blue-600 hover:bg-blue-50 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={handleArchiveClick} className="p-1.5 rounded-md hover:text-amber-600 hover:bg-amber-50 transition-colors">
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={handleDelete} className="p-1.5 rounded-md hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button onClick={handleShare} className="p-1.5 rounded-md hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={toggleSave}
                          disabled={isToggling}
                          className={cn(
                            "p-1.5 rounded-md transition-colors",
                            isSaved ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "hover:text-emerald-600 hover:bg-emerald-50"
                          )}
                        >
                          <Bookmark className={cn("w-3.5 h-3.5 transition-all", isSaved && "fill-emerald-500")} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardFooter>
          </Card>
        </Link>
      </div>

      <Dialog open={showBlockedInfo} onOpenChange={setShowBlockedInfo}>
        <DialogContent className="sm:max-w-md rounded-3xl p-8 gap-6 border-none shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-2 bg-red-50 dark:bg-red-900/20 text-red-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-red-600">{t('imageBlockedTitle')}</DialogTitle>
            <DialogDescription className="text-zinc-500 font-medium text-sm leading-relaxed">
              {t('imageBlockedDesc')}
              {item.moderation_result && (
                <span className="mt-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold text-xs uppercase italic block">
                  &quot;{item.moderation_result}&quot;
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button 
              type="button" 
              className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px] bg-zinc-900 hover:bg-zinc-800 text-white"
              onClick={() => setShowBlockedInfo(false)}
            >
              {t('ok')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
