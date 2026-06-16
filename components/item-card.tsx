"use client";

import Image from "next/image";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
  }
} // Барои нишон додани суратҳо
import Link from "next/link"; // Барои пайвандҳо
import { useRouter } from "next/navigation"; // Барои гузаштан ба саҳифаҳои дигар
import { Item } from "@/lib/services/item-service"; // Типи маълумоти эълон
import { Badge } from "@/components/ui/badge"; // Компоненти нишон
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Card, CardContent, CardFooter } from "@/components/ui/card"; // Компоненти корт
import { MapPin, Calendar, Bookmark, Pencil, Archive, Trash2, Share2, Loader2, AlertTriangle, ShieldAlert, Clock, AlertCircle, Sparkles } from "lucide-react"; // Иконкаҳо
import { useLanguage } from "@/lib/language-context"; // Барои тарҷумаи забон
import { format } from "date-fns"; // Барои формат кардани вақт
import { cn } from "@/lib/utils"; // Барои классҳои CSS
import { toast } from "sonner"; // Барои хабарҳои кӯтоҳ
import { useState, useEffect } from "react"; // Хукҳои React
import { useAuth } from "@clerk/nextjs"; // Барои аутентификатсия
import { createClerkSupabaseClient } from "@/lib/supabase"; // Барои пайваст шудан ба база
import { ItemService } from "@/lib/services/item-service"; // Сервиси эълонҳо
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Тирезаҳои огоҳӣ

// Пропҳои компонент
export function ItemCard({ item, index = 0, savedItemIds }: { item: Item, index?: number, savedItemIds?: Set<string> }) {
  // Хукҳо ва лоигкаи асосӣ
  const { t } = useLanguage();
  const router = useRouter();
  const { getToken, userId } = useAuth();

  // Состояниеҳо (States) барои идоракунии UI
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  // isSaved аз prop savedItemIds ҳисоб мешавад — бе query ба DB
  const [isSaved, setIsSaved] = useState(() => savedItemIds?.has(item.id) ?? false);
  const [isToggling, setIsToggling] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Состояние барои фаъол будани ротатсияи суратҳо
  const [isHovered, setIsHovered] = useState(false);

  // Санҷиши соҳиби эълон
  const isOwner = !!userId && userId === item.user_id;
  const exactDate = format(new Date(item.created_at), "dd.MM.yyyy");

  // Синхронизатсияи isSaved ҳангоми иваз шудани savedItemIds аз берун
  useEffect(() => {
    if (savedItemIds) {
      setIsSaved(savedItemIds.has(item.id));
    }
  }, [savedItemIds, item.id]);

  // Агар сурат набошад, плейсхолдер мемонем
  const images = item.images && item.images.length > 0
    ? item.images
    : [{ image_url: "https://placehold.co/600x600/e2e8f0/64748b?text=JUYO" }];

  // Логикаи сав/ансав (save/unsave)
  const toggleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!userId) {
      toast.info(t('pleaseLogin'));
      router.push("/sign-up");
      return;
    }

    // Optimistic Update: Аввал UI-ро иваз мекунем, баъд запрос мефиристем
    const previousSavedState = isSaved;
    const newSavedState = !previousSavedState;

    setIsSaved(newSavedState);
    setIsToggling(true);
    toast.success(newSavedState ? t('addedToSaved') : t('removedFromSaved'));

    // Запрос ба База (Background task)
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error("No token");

      const supabase = createClerkSupabaseClient(token);
      if (!userId) throw new Error("No userId");
      const saved = await ItemService.toggleSaveItem(supabase, userId, item.id);

      if (saved !== newSavedState) {
        setIsSaved(saved);
      }

      window.dispatchEvent(new Event('saved-items-updated'));
    } catch (e) {
      console.error("Toggle save error:", e);
      // Агар хатогӣ шавад, ба ҳолати пешина бармегардонем
      setIsSaved(previousSavedState);
      toast.error(t('error'));
    } finally {
      setIsToggling(false);
    }
  };

  // Функсияи паҳн кардан (Share)
  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isActionLoading) return;
    
    const url = `${window.location.origin}/items/${item.id}`;
    const shareData = {
      title: item.title,
      text: item.description,
      url: url,
    };
    
    if (navigator.share) {
      try {
        setIsActionLoading(true);
        await navigator.share(shareData);
      } catch (error: unknown) {
        const name = error instanceof Error ? error.name : '';
        if (name !== 'AbortError' && name !== 'NotAllowedError') {
          console.error("Share error:", error);
          navigator.clipboard.writeText(url);
          toast.success(t('success'));
        }
      } finally {
        setIsActionLoading(false);
      }
    } else if (typeof window !== "undefined" && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: "SHARE", payload: shareData })
      );
    } else {
      navigator.clipboard.writeText(url);
      toast.success(t('success'));
    }
  };

  // Гузаштан ба страницаи редактирование
  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/items/${item.id}/edit`);
  };

  // Кушодани тасдиқи архив (Safety Box)
  const handleArchiveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowArchiveConfirm(true);
  };

  // Функсияи тасдиқи архив (Запрос ба сервис)
  const confirmArchive = async () => {
    if (isActionLoading) return;
    
    setIsActionLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token || !userId) throw new Error("Not authenticated");
      const supabase = createClerkSupabaseClient(token);
      await ItemService.archiveToSafetyBox(supabase, item, userId);
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

  // Кушодани тасдиқи нест кардан
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  // Функсияи тасдиқи удаление (Запрос ба сервис)
  const confirmDelete = async () => {
    if (isActionLoading) return;
    
    setIsActionLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error("Not authenticated");
      const supabase = createClerkSupabaseClient(token);
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
      <Link 
        href={`/items/${item.id}`}
        prefetch={true}
        className="block h-fit"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setCurrentImageIndex(0); }}
      >
        <div className={cn(
          "relative aspect-square overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shimmer-bg group shadow-sm",
          item.moderation_status === 'rejected' && isOwner && "opacity-75 grayscale-[0.5]"
        )}>
          {/* Қисми болоии карточка: Сурат ва Баҷҳо */}
          {/* Оптимизатсияи намоиши суратҳо: Танҳо сурати фаъол ва навбатиро нишон медиҳем */}
          {images.map((img, i) => {
            if (Math.abs(i - currentImageIndex) > 1 && !(currentImageIndex === images.length - 1 && i === 0)) {
              return null;
            }
            return (
              <Image
                key={i}
                src={img.image_url}
                alt={item.title}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                quality={75}
                className={cn(
                  "object-cover",
                  i === currentImageIndex ? "opacity-100" : "opacity-0"
                )}
                priority={index < 12 && i === 0} // Танҳо барои 8 корти аввал priority мемонем
              />
            );
          })}

          {/* Overlay (Title, Date, Reward) - Darker bottom, clearer top */}
          <div
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/100 via-black/40 to-transparent p-3 pt-12 flex flex-col gap-1 z-10 pointer-events-none"
          >
            {item.type === 'lost' && item.reward && (
              <div className="flex justify-end">
                <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-500 font-black rounded-md text-[8px] sm:text-[10px] px-1.5 sm:px-2.5 py-0.5 sm:py-1 shadow-lg border-none whitespace-nowrap pointer-events-auto">
                  {t('reward_gives_viewer')} {item.reward} TJS
                </Badge>
              </div>
            )}
            <div className="relative">
              <h3 className="font-extrabold text-[11px] sm:text-sm lg:text-base line-clamp-2 leading-snug uppercase tracking-tight text-white drop-shadow-md pr-[70px] sm:pr-[82px]">
                {item.title}
              </h3>
              <div className="absolute right-0 top-0 flex items-center gap-1 text-white/90 text-[8px] sm:text-[10px] font-bold bg-black/60 px-1.5 py-0.5 rounded border border-white/10">
                <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span>{exactDate}</span>
              </div>
            </div>
          </div>
          
          {/* Статус: Гумшуда ё Ёфтшуда ва Фоизи Мувофиқат */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 flex flex-col gap-1.5 items-start">
            <Badge
              className={cn(
                "uppercase font-black rounded-md text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-0.5 sm:py-1 shadow-lg border-none whitespace-nowrap",
                item.type === 'lost'
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              )}
            >
              {item.type === 'lost' ? t('lost') : t('found')}
            </Badge>

            {item.similarity_score !== undefined && (
              <Badge className="bg-emerald-600 text-white font-black rounded-md text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-0.5 sm:py-1 shadow-lg border-none whitespace-nowrap">
                {Math.round(item.similarity_score * 100)}% {t('matchForYourImage')}
              </Badge>
            )}
          </div>

          {/* Тугмаҳои амалиёт (Actions) */}
          <div className="absolute top-2 right-2 z-20 flex flex-col gap-1.5 items-end">
            <button
              onClick={toggleSave}
              disabled={isToggling}
              aria-label={isSaved ? t('removedFromSaved') : t('addedToSaved')}
              aria-pressed={isSaved}
              className={cn(
                "p-1.5 sm:p-2 rounded-full transition-all shadow-md border border-white/10",
                isSaved
                  ? "bg-emerald-500 text-white"
                  : "bg-black/50 text-white hover:bg-black/70",
                isOwner && "sm:hidden"
              )}
            >
              <Bookmark className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", isSaved && "fill-current")} />
            </button>

            {isOwner && (
              <>
                <button 
                  onClick={handleEdit}
                  className="hidden sm:flex p-1.5 sm:p-2 rounded-full bg-black/50 text-white hover:bg-blue-600 transition-all shadow-md border border-white/10"
                >
                  <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button 
                  onClick={handleArchiveClick}
                  className="hidden sm:flex p-1.5 sm:p-2 rounded-full bg-black/50 text-white hover:bg-amber-600 transition-all shadow-md border border-white/10"
                >
                  <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button 
                  onClick={handleDelete}
                  className="hidden sm:flex p-1.5 sm:p-2 rounded-full bg-black/50 text-white hover:bg-red-600 transition-all shadow-md border border-white/10"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </>
            )}
            
            <button 
              onClick={handleShare}
              className="p-1.5 sm:p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all shadow-md border border-white/10"
            >
              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>


          {isOwner && item.moderation_status === 'pending' && (
            <div 
              className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-30 cursor-pointer backdrop-blur-[2px]"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Барои ҳолати дар интизорӣ, мо метавонем як хабар нишон диҳем
                toast.info(t('imageModeration.pending'));
              }}
            >
              <div className="bg-white/95 dark:bg-zinc-900/95 p-4 rounded-2xl shadow-2xl flex flex-col items-center text-center gap-3 animate-in zoom-in duration-300">
                <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center animate-pulse">
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
                <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider block">
                  {t('imageModeration.pending')}
                </span>
              </div>
            </div>
          )}

          {isOwner && item.moderation_status === 'rejected' && (
            <div 
              className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-30 cursor-pointer backdrop-blur-[4px]"
            >
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-2xl flex flex-col items-center text-center gap-3 animate-in zoom-in duration-300 border border-red-500/20">
                <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6 text-red-600" />
                </div>
                <span className="text-[10px] font-black uppercase text-red-600 tracking-wider block">
                  {t('imageModeration.rejected')}
                </span>
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* Модал барои тасдиқи нест кардан */}
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

      {/* Модал барои тасдиқи ба архив мондан */}
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
