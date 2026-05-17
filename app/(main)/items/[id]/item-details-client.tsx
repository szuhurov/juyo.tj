/**
 * Ин қисми клиентии саҳифаи тафсилоти эълон ҳаст.
 * Тамоми логикаи интерактивӣ (тугмаҳо, карусел ва ғайра) дар ин ҷост.
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { Item, ItemService } from "@/lib/services/item-service";
import { useLanguage } from "@/lib/language-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar, Phone, Eye, ArrowLeft, ShieldCheck, User, 
  ChevronLeft, ChevronRight, Share2, Bookmark, Pencil, 
  Archive, Trash2, CheckCircle2, ShieldAlert, Loader2 
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { useItemDetails } from "@/lib/hooks/use-items";
import { useQueryClient } from "@tanstack/react-query";

export default function ItemDetailsClient({ id }: { id: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { getToken, userId, isLoaded } = useAuth();
  const queryClient = useQueryClient();
  
  const [token, setToken] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const viewIncremented = useRef(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showResolvedConfirm, setShowResolvedConfirm] = useState(false);
  const [showBlockedInfo, setShowBlockedInfo] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      getToken({ template: 'supabase' }).then(setToken);
    }
  }, [isLoaded, getToken]);

  const { data: item, isLoading: loading } = useItemDetails(id, token);
  const isOwner = userId === item?.user_id;

  // Логикаи Swipe барои мобил
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const images = item?.images && item.images.length > 0 
    ? item.images 
    : [{ image_url: "https://placehold.co/600x600/e2e8f0/64748b?text=JUYO" }];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      setCurrentImageIndex((p) => (p + 1) % images.length);
    } else if (isRightSwipe) {
      setCurrentImageIndex((p) => (p - 1 + images.length) % images.length);
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
    setIsAutoPlaying(false);
  };

  useEffect(() => {
    if (isLoaded && item && !viewIncremented.current) {
      const isActuallyOwner = userId === item.user_id;
      if (!isActuallyOwner) {
        const sessionKey = `viewed_${id}`;
        if (!sessionStorage.getItem(sessionKey)) {
          viewIncremented.current = true;
          ItemService.incrementView(id).then(() => {
            sessionStorage.setItem(sessionKey, 'true');
            queryClient.setQueryData(['items', 'detail', id], (old: any) => ({
              ...old, views: (old?.views || 0) + 1
            }));
          });
        }
      }
      viewIncremented.current = true;
    }
  }, [id, userId, isLoaded, item, queryClient]);

  useEffect(() => {
    if (userId && id) {
      checkInitialSavedState();
    }
  }, [id, userId]);

  useEffect(() => {
    if (isLoaded && item && isOwner && item.moderation_status === 'rejected') {
      setShowBlockedInfo(true);
    }
  }, [isLoaded, item, isOwner]);

  const checkInitialSavedState = async () => {
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);
      const { data } = await supabase.from('saved_items').select('item_id').eq('user_id', userId).eq('item_id', id).maybeSingle();
      setIsSaved(!!data);
    } catch (e) {
      setIsSaved(false);
    }
  };

  const toggleSave = async () => {
    if (!userId) {
      toast.info(t('pleaseLogin'));
      router.push("/sign-up");
      return;
    }
    if (isToggling) return;
    setIsToggling(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      const saved = await ItemService.toggleSaveItem(supabase, userId!, id);
      setIsSaved(saved);
      toast.success(saved ? t('addedToSaved') : t('removedFromSaved'));
      queryClient.invalidateQueries({ queryKey: ['items', 'saved', userId] });
    } catch (e) {
      toast.error(t('error'));
    } finally {
      setIsToggling(false);
    }
  };

  useEffect(() => {
    if (!isAutoPlaying || images.length <= 1) return;
    const interval = setInterval(() => setCurrentImageIndex((p) => (p + 1) % images.length), 3000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, images.length]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: item?.title, text: item?.description, url: window.location.href }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success(t('success'));
    }
  };

  const handleDelete = async () => {
    setIsActionLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      await ItemService.deleteItem(supabase, id);
      toast.success(t('success'));
      router.push('/');
    } catch (e) { toast.error(t('error')); } finally { setIsActionLoading(false); setShowDeleteConfirm(false); }
  };

  const handleArchive = async () => {
    setIsActionLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      await ItemService.archiveToSafetyBox(supabase, item!, userId!);
      toast.success(t('moveToSafeSuccess'));
      router.push('/profile?tab=safety');
    } catch (e) { toast.error(t('error')); } finally { setIsActionLoading(false); setShowArchiveConfirm(false); }
  };

  const handleResolved = async () => {
    setIsActionLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      await ItemService.deleteItem(supabase, id);
      toast.success(t('itemResolvedSuccess'));
      router.push('/');
    } catch (e) { toast.error(t('error')); } finally { setIsActionLoading(false); setShowResolvedConfirm(false); }
  };

  if (loading && !item) return <div className="mx-auto max-w-6xl md:pt-8 px-4 py-4 md:px-4"><Skeleton className="w-full aspect-square rounded-[32px]" /></div>;
  if (!item) return <div className="container mx-auto px-4 py-20 text-center"><h1 className="text-2xl font-bold">{t('itemNotFound')}</h1></div>;

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-6xl md:pt-8 md:px-4">
        {/* Layout Grid: Desktop use columns, Mobile use stacking with sticky effect */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-12 items-start relative">
          
          {/* Галереяи суратҳо: Sticky on Mobile and Desktop */}
          <div className="sticky top-0 md:top-24 z-0 w-full p-0 md:p-0 flex items-center justify-center">
            <div 
              className="relative aspect-square w-full max-w-[600px] overflow-hidden rounded-none md:rounded-[32px] border-b md:border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 group shadow-xl"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {images.map((img, index) => (
                <Image 
                  key={index} 
                  src={img.image_url} 
                  alt={item.title} 
                  fill 
                  className={cn(
                    "object-cover transition-all duration-500", 
                    index === currentImageIndex ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
                  )} 
                  priority={index === 0}
                />
              ))}
              
              {/* Нишондиҳандаи саҳифа (Dots) */}
              {images.length > 1 && (
                <div className="absolute bottom-10 md:bottom-6 left-0 right-0 flex justify-center gap-1.5 z-20">
                  {images.map((_, i) => (
                    <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all", i === currentImageIndex ? "bg-white w-4" : "bg-white/40")} />
                  ))}
                </div>
              )}

              {/* Restore Navigation Arrows */}
              {images.length > 1 && (
                <div className="flex md:block">
                  <button onClick={() => setCurrentImageIndex((p) => (p - 1 + images.length) % images.length)} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm border border-zinc-200 flex items-center justify-center z-20 hover:bg-white transition-colors shadow-sm hidden md:flex"><ChevronLeft className="w-6 h-6" /></button>
                  <button onClick={() => setCurrentImageIndex((p) => (p + 1) % images.length)} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm border border-zinc-200 flex items-center justify-center z-20 hover:bg-white transition-colors shadow-sm hidden md:flex"><ChevronRight className="w-6 h-6" /></button>
                </div>
              )}

              <Badge className={cn("absolute top-4 left-4 uppercase font-black rounded-md px-3 py-1 shadow-md border-none z-10", item.type === 'lost' ? "bg-red-600 text-white" : "bg-emerald-600 text-white")}>
                {item.type === 'lost' ? t('lost') : t('found')}
              </Badge>
            </div>
          </div>

          {/* Маълумоти эълон: Scrolls OVER image on mobile */}
          <div className="flex flex-col relative z-10 bg-white dark:bg-zinc-950 rounded-t-[2.5rem] md:rounded-none -mt-8 md:mt-0 px-5 pt-10 md:px-0 md:pt-0 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-none">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-200 shadow-sm">
                  {item.profiles?.avatar_url ? (<Image src={item.profiles.avatar_url} alt="User" width={48} height={48} className="object-cover" />) : (<User className="w-6 h-6 text-zinc-400" />)}
                </div>
                <div className="flex flex-col">
                  <p className="font-black text-sm leading-tight uppercase">
                    {item.profiles?.first_name || t('user')}
                  </p>
                  {item.profiles?.last_name && (
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">
                      {item.profiles.last_name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-black uppercase"><Eye className="w-4 h-4" /> {item.views || 0}</div>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none mb-6">{item.title}</h1>
            
            {item.type === 'lost' && item.reward && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-2xl p-5 mb-8 shadow-sm">
                <p className="text-amber-600 font-black text-[10px] uppercase mb-1">{t('reward_gives_viewer')}</p>
                <p className="text-3xl font-black text-amber-900 dark:text-amber-100">{item.reward} TJS</p>
              </div>
            )}

            <div className="mb-8">
              <h3 className="font-black text-[10px] uppercase text-zinc-400 mb-4">{t('description')}</h3>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-base whitespace-pre-wrap font-medium">{item.description}</p>
            </div>

            {/* Management Buttons for Owner - Compact for Mobile Row */}
            <div className="flex flex-row items-center gap-2.5 mb-10 overflow-x-auto no-scrollbar pb-1">
              {isLoaded && isOwner && (
                <>
                  <Button variant="secondary" size="icon" className="h-12 w-12 shrink-0 md:h-16 md:w-16 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm" asChild><Link href={`/items/${id}/edit`}><Pencil className="w-5 h-5 md:w-7 md:h-7" /></Link></Button>
                  <Button variant="secondary" size="icon" className="h-12 w-12 shrink-0 md:h-16 md:w-16 rounded-xl bg-amber-50 dark:bg-amber-900/10 text-amber-600 border border-amber-100/50 shadow-sm" onClick={() => setShowArchiveConfirm(true)} disabled={isActionLoading}><Archive className="w-5 h-5 md:w-7 md:h-7" /></Button>
                  <Button variant="secondary" size="icon" className="h-12 w-12 shrink-0 md:h-16 md:w-16 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-600 border border-red-100/50 shadow-sm" onClick={() => setShowDeleteConfirm(true)} disabled={isActionLoading}><Trash2 className="w-5 h-5 md:w-7 md:h-7" /></Button>
                </>
              )}
              <Button variant="secondary" size="icon" className="h-12 w-12 shrink-0 md:h-16 md:w-16 rounded-xl bg-blue-50 dark:bg-blue-900/10 text-blue-600 border border-blue-100/50 shadow-sm" onClick={handleShare}><Share2 className="w-5 h-5 md:w-7 md:h-7" /></Button>
              <Button variant="secondary" size="icon" className={cn("h-12 w-12 shrink-0 md:h-16 md:w-16 rounded-xl transition-all border shadow-sm", isSaved ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100")} onClick={toggleSave} disabled={isToggling}><Bookmark className={cn("w-5 h-5 md:w-7 md:h-7", isSaved && "fill-emerald-600")} /></Button>
            </div>

            <div className="mt-auto flex flex-col gap-3">
              {isLoaded && isOwner ? (
                <Button size="lg" className="h-14 md:h-16 w-full rounded-2xl font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg" onClick={() => setShowResolvedConfirm(true)} disabled={isActionLoading}>
                  <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 mr-2" /> {t('resolved')}
                </Button>
              ) : (
                <>
                  <Button size="lg" className="h-14 md:h-16 w-full rounded-2xl font-black bg-zinc-900 hover:bg-zinc-800 text-white shadow-lg" asChild><a href={`tel:${item.phone_number}`}><Phone className="w-5 h-5 md:w-6 md:h-6 mr-2" /> {t('call')}</a></Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dialogs... */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="rounded-3xl border-none shadow-2xl">
            <DialogHeader><DialogTitle className="text-red-600 font-black uppercase">{t('deleteConfirm')}</DialogTitle></DialogHeader>
            <DialogFooter className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isActionLoading}>
                {t('cancel')}
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isActionLoading}>
                {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t('delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
          <DialogContent className="rounded-3xl border-none shadow-2xl">
            <DialogHeader><DialogTitle className="text-amber-600 font-black uppercase">{t('moveToSafe')}</DialogTitle></DialogHeader>
            <DialogFooter className="flex gap-3">
              <Button variant="outline" onClick={() => setShowArchiveConfirm(false)} disabled={isActionLoading}>
                {t('cancel')}
              </Button>
              <Button className="bg-amber-600" onClick={handleArchive} disabled={isActionLoading}>
                {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t('moveToSafe')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={showResolvedConfirm} onOpenChange={setShowResolvedConfirm}>
          <DialogContent className="rounded-3xl border-none shadow-2xl">
            <DialogHeader><DialogTitle className="text-emerald-600 font-black uppercase">{t('resolved')}</DialogTitle></DialogHeader>
            <DialogFooter className="flex gap-3">
              <Button variant="outline" onClick={() => setShowResolvedConfirm(false)} disabled={isActionLoading}>
                {t('cancel')}
              </Button>
              <Button className="bg-emerald-600" onClick={handleResolved} disabled={isActionLoading}>
                {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t('resolved')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Модал барои нишон додани сабаби блок шудани сурат ё матн */}
        <Dialog open={showBlockedInfo} onOpenChange={setShowBlockedInfo}>
          <DialogContent className="sm:max-w-md rounded-3xl p-8 gap-6 border-none shadow-2xl">
            <DialogHeader className="space-y-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-2 bg-red-50 dark:bg-red-900/20 text-red-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-red-600">
                {item?.moderation_result?.startsWith('mod_offensive_text') ? t('textBlockedTitle') : t('imageBlockedTitle')}
              </DialogTitle>
              <div className="text-zinc-500 font-bold text-sm leading-relaxed">
                <p className="mb-4">{item?.moderation_result?.startsWith('mod_offensive_text') ? t('textBlockedDesc') : t('imageBlockedDesc')}</p>
                
                {item?.moderation_result && (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-black text-xs uppercase italic">
                    {item.moderation_result.includes(':') ? (
                      <p>
                        {t(item.moderation_result.split(':')[0])}:{" "}
                        <span className="text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                          {item.moderation_result.split(':')[1]}
                        </span>
                      </p>
                    ) : (
                      t(item.moderation_result)
                    )}
                  </div>
                )}
              </div>
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
      </div>
    </TooltipProvider>
  );
}
