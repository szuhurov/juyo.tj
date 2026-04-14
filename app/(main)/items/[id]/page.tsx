"use client";

import { useEffect, useState, use, useRef } from "react";
import { Item, ItemService } from "@/lib/services/item-service";
import { useLanguage } from "@/lib/language-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Phone, Eye, ArrowLeft, ShieldCheck, User, ChevronLeft, ChevronRight, Share2, Bookmark, Pencil, Archive, Trash2, CheckCircle2, ShieldAlert, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useItemDetails } from "@/lib/hooks/use-items";
import { useQueryClient } from "@tanstack/react-query";

export default function ItemDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();
  const router = useRouter();
  const { getToken, userId, isLoaded } = useAuth();
  const queryClient = useQueryClient();
  
  // Use TanStack Query for caching
  const [token, setToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (isLoaded) {
      getToken({ template: 'supabase' }).then(setToken);
    }
  }, [isLoaded, getToken]);

  const { data: item, isLoading: loading } = useItemDetails(id, token);
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const viewIncremented = useRef(false);
  
  // Confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showResolvedConfirm, setShowResolvedConfirm] = useState(false);
  const [showBlockedInfo, setShowBlockedInfo] = useState(false);

  const isOwner = userId === item?.user_id;

  // View increment logic
  useEffect(() => {
    if (isLoaded && item && !viewIncremented.current) {
      const isActuallyOwner = userId === item.user_id;
      
      if (!isActuallyOwner) {
        const sessionKey = `viewed_${id}`;
        if (!sessionStorage.getItem(sessionKey)) {
          viewIncremented.current = true;
          ItemService.incrementView(id).then(() => {
            sessionStorage.setItem(sessionKey, 'true');
            // Optimistically update local cache
            queryClient.setQueryData(['items', 'detail', id], (old: any) => ({
              ...old,
              views: (old?.views || 0) + 1
            }));
          });
        }
      }
      viewIncremented.current = true;
    }
  }, [id, userId, isLoaded, item, queryClient]);

  // Initial saved state check
  useEffect(() => {
    if (userId && id) {
      checkInitialSavedState();
    }
  }, [id, userId]);

  const checkInitialSavedState = async () => {
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) return;
      
      const supabase = createClerkSupabaseClient(token!);
      const { data, error } = await supabase
        .from('saved_items')
        .select('item_id')
        .eq('user_id', userId)
        .eq('item_id', id)
        .maybeSingle();
      
      if (error) throw error;
      setIsSaved(!!data);
    } catch (e) {
      console.error("Error checking saved state from DB:", e);
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
      if (!token) throw new Error("No token");
      
      const supabase = createClerkSupabaseClient(token!);
      const saved = await ItemService.toggleSaveItem(supabase, userId!, id);
      setIsSaved(saved);
      toast.success(saved ? t('addedToSaved') : t('removedFromSaved'));
      
      // Invalidate saved items query to refresh profile page cache
      queryClient.invalidateQueries({ queryKey: ['items', 'saved', userId] });
      window.dispatchEvent(new Event('saved-items-updated'));
    } catch (e) {
      console.error("Error toggling save in DB:", e);
      toast.error(t('error'));
    } finally {
      setIsToggling(false);
    }
  };

  // Auto-show blocked info if item is rejected
  useEffect(() => {
    if (item?.moderation_status === 'rejected') {
      setShowBlockedInfo(true);
    }
  }, [item?.moderation_status]);

  const images = item?.images && item.images.length > 0 
    ? item.images 
    : [{ image_url: "https://placehold.co/600x600/e2e8f0/64748b?text=JUYO" }];

  useEffect(() => {
    if (!isAutoPlaying || images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, images.length]);

  const nextImage = () => {
    setIsAutoPlaying(false);
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setIsAutoPlaying(false);
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: item?.title || "JUYO",
        text: item?.description || "Check this out on JUYO",
        url: window.location.href,
      }).catch(console.error);
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
    } catch (error) {
      toast.error(t('error'));
    } finally {
      setIsActionLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleArchive = async () => {
    setIsActionLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      await ItemService.archiveToSafetyBox(supabase, item!, userId!);
      toast.success(t('moveToSafeSuccess'));
      router.push('/profile?tab=safety');
    } catch (error: any) {
      console.error("Archive Error:", error);
      const msg = error.message || t('error');
      const code = error.code || "no-code";
      toast.error(`Хатогии интиқол: ${msg} (Код: ${code})`);
    } finally {
      setIsActionLoading(false);
      setShowArchiveConfirm(false);
    }
  };

  const handleResolved = async () => {
    setIsActionLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(token!);
      await ItemService.deleteItem(supabase, id);
      toast.success(t('itemResolvedSuccess'));
      router.push('/');
    } catch (error) {
      toast.error(t('error'));
    } finally {
      setIsActionLoading(false);
      setShowResolvedConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          <Skeleton className="w-full md:w-1/2 aspect-square rounded-xl" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-10 w-3/4 rounded-md" />
            <Skeleton className="h-6 w-1/4 rounded-md" />
            <Skeleton className="h-32 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">{t('itemNotFound')}</h1>
        <Button asChild className="mt-4 rounded-md">
          <Link href="/">{t('btnHome')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button variant="ghost" asChild className="mb-6 gap-2 rounded-xl font-black uppercase text-[10px] tracking-widest bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 transition-colors">
          <Link href="/">
            <ArrowLeft className="w-4 h-4" /> {t('home')}
          </Link>
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          {/* Images Carousel */}
          <div className="md:sticky md:top-24 space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-md bg-zinc-100 dark:bg-zinc-950 group">
              {images.map((img, index) => (
                <Image
                  key={index}
                  src={img.image_url}
                  alt={item.title}
                  fill
                  className={cn(
                    "object-cover transition-all duration-700 ease-in-out",
                    index === currentImageIndex ? "opacity-100 scale-100" : "opacity-0 scale-105"
                  )}
                  priority={index === 0}
                />
              ))}
              
              {/* Carousel Controls - Always Visible */}
              {images.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm border border-zinc-200 flex items-center justify-center text-zinc-800 transition-all hover:bg-white z-20"><ChevronLeft className="w-6 h-6" /></button>
                  <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm border border-zinc-200 flex items-center justify-center text-zinc-800 transition-all hover:bg-white z-20"><ChevronRight className="w-6 h-6" /></button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">{images.map((_, i) => (<div key={i} className={cn("h-1.5 rounded-full transition-all", i === currentImageIndex ? "w-6 bg-white shadow-sm" : "w-1.5 bg-white/50")}/>))}</div>
                </>
              )}

              <Badge className={cn("absolute top-4 left-4 uppercase font-black rounded-md px-3 py-1 shadow-md border-none z-10", item.type === 'lost' ? "bg-red-600 text-white" : "bg-emerald-600 text-white")}>
                {item.type === 'lost' ? t('lost') : t('found')}
              </Badge>
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  {item.profiles?.avatar_url ? (<Image src={item.profiles.avatar_url} alt="User" width={48} height={48} className="object-cover w-full h-full" />) : (<User className="w-6 h-6 text-zinc-400" />)}
                </div>
                <div>
                  <p className="font-black text-sm leading-tight uppercase tracking-tight">{item.profiles?.first_name || t('user')}</p>
                  <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-0.5">{item.profiles?.last_name || ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-black uppercase tracking-widest">
                <Eye className="w-4 h-4" /> {item.views || 0}
              </div>
            </div>

            {/* Category and Date Row */}
            <div className="flex justify-between items-center mb-4">
              <Badge variant="outline" className="uppercase tracking-widest text-[10px] rounded-md px-2 py-1 font-black border-zinc-200">
                {t(`categories.${item.category}`)}
              </Badge>
              <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                <Calendar className="w-3.5 h-3.5" />
                <span>{item.created_at ? format(new Date(item.created_at), "dd.MM.yyyy") : ""}</span>
              </div>
            </div>

            <div className="flex flex-col mb-4">
              {/* Title and Status Row */}
              <div className="flex justify-between items-start gap-4 mb-2">
                <h1 className="text-4xl font-black tracking-tighter uppercase leading-none flex-1">{item.title}</h1>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border shrink-0",
                  item.type === 'lost' 
                    ? "text-red-600 border-red-100 bg-red-50 dark:bg-red-950/20 dark:border-red-900/30" 
                    : "text-emerald-600 border-emerald-100 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/30"
                )}>
                  {item.type === 'lost' ? t('lost') : t('found')}
                </span>
              </div>
            </div>

            {item.reward && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-5 mb-8 shadow-sm">
                <p className="text-amber-600 dark:text-amber-400 font-black text-[10px] uppercase tracking-widest mb-1 leading-tight">
                  {item.type === 'lost' ? t('reward_gives_viewer') : t('reward_wants_viewer')}
                </p>
                <p className="text-3xl font-black text-amber-900 dark:text-amber-100 tracking-tight">
                  {item.reward} <span className="text-xl">TJS</span>
                </p>
              </div>
            )}

            <div className="mb-8">
              <h3 className="font-black text-[10px] uppercase tracking-widest text-zinc-400 mb-4">{t('description')}</h3>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-base whitespace-pre-wrap font-medium">
                {item.description}
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-2xl p-5 mb-8 flex gap-4 items-start border border-blue-100 dark:border-blue-900/30 shadow-sm">
              <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-[10px] uppercase tracking-widest text-blue-900 dark:text-blue-400 mb-1">{t('safetyTitle')}</p>
                <p className="text-xs text-blue-700 dark:text-blue-500 font-medium leading-relaxed">{t('safetyText')}</p>
              </div>
            </div>

            {/* Action Buttons - Always Visible with Proper Labels */}
            <div className="flex flex-wrap items-center gap-4 mb-10">
              {isOwner && (
                <>
                  <div className="flex flex-col gap-2 items-center">
                    <Button variant="secondary" size="icon" className="h-16 w-16 rounded-2xl bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900/50 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800 transition-all active:scale-95 shadow-sm" asChild>
                      <Link href={`/items/${id}/edit`}>
                        <Pencil className="w-7 h-7" />
                      </Link>
                    </Button>
                    <span className="text-[9px] font-black uppercase text-zinc-500 tracking-tighter">{t('edit')}</span>
                  </div>
                  <div className="flex flex-col gap-2 items-center">
                    <Button variant="secondary" size="icon" className="h-16 w-16 rounded-2xl bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/10 dark:text-amber-400 border border-amber-100/50 dark:border-amber-900/30 transition-all active:scale-95 shadow-sm" onClick={() => setShowArchiveConfirm(true)} disabled={isActionLoading}><Archive className="w-7 h-7" /></Button>
                    <span className="text-[9px] font-black uppercase text-amber-600/70 tracking-tighter">{t('moveToSafe')}</span>
                  </div>
                  <div className="flex flex-col gap-2 items-center">
                    <Button variant="secondary" size="icon" className="h-16 w-16 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/10 dark:text-red-400 border border-red-100/50 dark:border-red-900/30 transition-all active:scale-95 shadow-sm" onClick={() => setShowDeleteConfirm(true)} disabled={isActionLoading}><Trash2 className="w-7 h-7" /></Button>
                    <span className="text-[9px] font-black uppercase text-red-600/70 tracking-tighter">{t('delete')}</span>
                  </div>
                </>
              )}
              <div className="flex flex-col gap-2 items-center">
                <Button variant="secondary" size="icon" className="h-16 w-16 rounded-2xl bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/10 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30 transition-all active:scale-95 shadow-sm" onClick={handleShare}><Share2 className="w-7 h-7" /></Button>
                <span className="text-[9px] font-black uppercase text-blue-600/70 tracking-tighter">{t('share')}</span>
              </div>
              <div className="flex flex-col gap-2 items-center">
                <Button variant="secondary" size="icon" className={cn("h-16 w-16 rounded-2xl transition-all active:scale-95 border shadow-sm", isSaved ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30" : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-900/50 dark:text-zinc-400 border-zinc-100 dark:border-zinc-800")} onClick={toggleSave} disabled={isToggling}><Bookmark className={cn("w-7 h-7 transition-all", isSaved && "fill-emerald-600 dark:fill-emerald-400")} /></Button>
                <span className={cn("text-[9px] font-black uppercase tracking-tighter", isSaved ? "text-emerald-600/70" : "text-zinc-400")}>{t('save')}</span>
              </div>
            </div>

            <div className="mt-auto">
              {isOwner ? (
                <Button size="lg" className="h-16 w-full rounded-2xl text-base font-black gap-3 bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-none uppercase tracking-widest text-white transition-all active:scale-95" onClick={() => setShowResolvedConfirm(true)} disabled={isActionLoading}><CheckCircle2 className="w-6 h-6" /> {t('resolved')}</Button>
              ) : (
                <Button size="lg" className="h-16 w-full rounded-2xl text-base font-black gap-3 bg-zinc-900 hover:bg-zinc-800 shadow-xl shadow-zinc-100 dark:shadow-none text-white transition-all active:scale-95 uppercase tracking-widest" asChild>
                  <a href={`tel:${item.phone_number}`}><Phone className="w-6 h-6" /> {t('call')}</a>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Confirmation Modals */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="rounded-3xl max-w-sm border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-red-600">{t('deleteConfirm')}</DialogTitle>
              <DialogDescription className="font-medium pt-3 text-zinc-500">{t('deletePostConfirm')}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-row gap-3 mt-6">
              <Button variant="outline" className="flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 border-zinc-200" onClick={() => setShowDeleteConfirm(false)}>{t('cancel')}</Button>
              <Button variant="destructive" className="flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={isActionLoading}>{t('delete')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
          <DialogContent className="rounded-3xl max-w-sm border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-amber-600">{t('moveToSafe')}</DialogTitle>
              <DialogDescription className="font-medium pt-3 text-zinc-500">{t('moveToSafeDesc')}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-row gap-3 mt-6">
              <Button variant="outline" className="flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 border-zinc-200" onClick={() => setShowArchiveConfirm(false)}>{t('cancel')}</Button>
              <Button className="flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleArchive} disabled={isActionLoading}>{t('moveToSafe')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showResolvedConfirm} onOpenChange={setShowResolvedConfirm}>
          <DialogContent className="rounded-3xl max-w-sm border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-emerald-600">{t('resolved')}</DialogTitle>
              <DialogDescription className="font-medium pt-3 text-zinc-500">{t('resolvedConfirm')}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-row gap-3 mt-6">
              <Button variant="outline" className="flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 border-zinc-200" onClick={() => setShowResolvedConfirm(false)}>{t('cancel')}</Button>
              <Button className="flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleResolved} disabled={isActionLoading}>{t('resolved')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
      </div>
    </TooltipProvider>
  );
}