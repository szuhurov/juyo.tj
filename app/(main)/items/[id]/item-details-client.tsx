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
  Archive, Trash2, CheckCircle2, ShieldAlert 
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

  const images = item?.images && item.images.length > 0 
    ? item.images 
    : [{ image_url: "https://placehold.co/600x600/e2e8f0/64748b?text=JUYO" }];

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

  if (loading) return <div className="container mx-auto px-4 py-8"><Skeleton className="w-full aspect-square rounded-xl" /></div>;
  if (!item) return <div className="container mx-auto px-4 py-20 text-center"><h1 className="text-2xl font-bold">{t('itemNotFound')}</h1></div>;

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button variant="ghost" asChild className="mb-6 gap-2 rounded-xl font-black uppercase text-[10px] tracking-widest bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 transition-colors">
          <Link href="/"><ArrowLeft className="w-4 h-4" /> {t('home')}</Link>
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div className="md:sticky md:top-24 space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-md bg-zinc-100 dark:bg-zinc-950 group">
              {images.map((img, index) => (
                <Image key={index} src={img.image_url} alt={item.title} fill className={cn("object-cover transition-all duration-700", index === currentImageIndex ? "opacity-100 scale-100" : "opacity-0 scale-105")} priority={index === 0} />
              ))}
              {images.length > 1 && (
                <>
                  <button onClick={() => setCurrentImageIndex((p) => (p - 1 + images.length) % images.length)} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm border border-zinc-200 flex items-center justify-center z-20"><ChevronLeft className="w-6 h-6" /></button>
                  <button onClick={() => setCurrentImageIndex((p) => (p + 1) % images.length)} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm border border-zinc-200 flex items-center justify-center z-20"><ChevronRight className="w-6 h-6" /></button>
                </>
              )}
              <Badge className={cn("absolute top-4 left-4 uppercase font-black rounded-md px-3 py-1 shadow-md border-none z-10", item.type === 'lost' ? "bg-red-600 text-white" : "bg-emerald-600 text-white")}>
                {item.type === 'lost' ? t('lost') : t('found')}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-200 shadow-sm">
                  {item.profiles?.avatar_url ? (<Image src={item.profiles.avatar_url} alt="User" width={48} height={48} className="object-cover" />) : (<User className="w-6 h-6 text-zinc-400" />)}
                </div>
                <div><p className="font-black text-sm leading-tight uppercase">{item.profiles?.first_name || t('user')}</p></div>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-black uppercase"><Eye className="w-4 h-4" /> {item.views || 0}</div>
            </div>

            <h1 className="text-4xl font-black tracking-tighter uppercase leading-none mb-6">{item.title}</h1>
            
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

            <div className="flex flex-wrap items-center gap-4 mb-10">
              {isOwner && (
                <>
                  <Button variant="secondary" size="icon" className="h-16 w-16 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800" asChild><Link href={`/items/${id}/edit`}><Pencil className="w-7 h-7" /></Link></Button>
                  <Button variant="secondary" size="icon" className="h-16 w-16 rounded-2xl bg-amber-50 dark:bg-amber-900/10 text-amber-600 border border-amber-100/50" onClick={() => setShowArchiveConfirm(true)} disabled={isActionLoading}><Archive className="w-7 h-7" /></Button>
                  <Button variant="secondary" size="icon" className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-900/10 text-red-600 border border-red-100/50" onClick={() => setShowDeleteConfirm(true)} disabled={isActionLoading}><Trash2 className="w-7 h-7" /></Button>
                </>
              )}
              <Button variant="secondary" size="icon" className="h-16 w-16 rounded-2xl bg-blue-50 dark:bg-blue-900/10 text-blue-600 border border-blue-100/50" onClick={handleShare}><Share2 className="w-7 h-7" /></Button>
              <Button variant="secondary" size="icon" className={cn("h-16 w-16 rounded-2xl transition-all border shadow-sm", isSaved ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100")} onClick={toggleSave} disabled={isToggling}><Bookmark className={cn("w-7 h-7", isSaved && "fill-emerald-600")} /></Button>
            </div>

            <div className="mt-auto flex flex-col gap-3">
              {isOwner ? (
                <Button size="lg" className="h-16 w-full rounded-2xl font-black bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowResolvedConfirm(true)} disabled={isActionLoading}>
                  <CheckCircle2 className="w-6 h-6 mr-2" /> {t('resolved')}
                </Button>
              ) : (
                <>
                  <Button size="lg" className="h-16 w-full rounded-2xl font-black bg-zinc-900 hover:bg-zinc-800 text-white" asChild><a href={`tel:${item.phone_number}`}><Phone className="w-6 h-6 mr-2" /> {t('call')} (1)</a></Button>
                  {item.profiles?.secondary_phone && (
                    <Button size="lg" variant="outline" className="h-16 w-full rounded-2xl font-black border-2" asChild><a href={`tel:${item.profiles.secondary_phone}`}><Phone className="w-6 h-6 mr-2 text-emerald-600" /> {t('call')} (2)</a></Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dialogs... */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="rounded-3xl border-none shadow-2xl">
            <DialogHeader><DialogTitle className="text-red-600 font-black uppercase">{t('deleteConfirm')}</DialogTitle></DialogHeader>
            <DialogFooter className="flex gap-3"><Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>{t('cancel')}</Button><Button variant="destructive" onClick={handleDelete}>{t('delete')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
          <DialogContent className="rounded-3xl border-none shadow-2xl">
            <DialogHeader><DialogTitle className="text-amber-600 font-black uppercase">{t('moveToSafe')}</DialogTitle></DialogHeader>
            <DialogFooter className="flex gap-3"><Button variant="outline" onClick={() => setShowArchiveConfirm(false)}>{t('cancel')}</Button><Button className="bg-amber-600" onClick={handleArchive}>{t('moveToSafe')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={showResolvedConfirm} onOpenChange={setShowResolvedConfirm}>
          <DialogContent className="rounded-3xl border-none shadow-2xl">
            <DialogHeader><DialogTitle className="text-emerald-600 font-black uppercase">{t('resolved')}</DialogTitle></DialogHeader>
            <DialogFooter className="flex gap-3"><Button variant="outline" onClick={() => setShowResolvedConfirm(false)}>{t('cancel')}</Button><Button className="bg-emerald-600" onClick={handleResolved}>{t('resolved')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Модал барои нишон додани сабаби блок шудани сурат */}
        <Dialog open={showBlockedInfo} onOpenChange={setShowBlockedInfo}>
          <DialogContent className="sm:max-w-md rounded-3xl p-8 gap-6 border-none shadow-2xl">
            <DialogHeader className="space-y-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-2 bg-red-50 dark:bg-red-900/20 text-red-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-red-600">{t('imageBlockedTitle')}</DialogTitle>
              <DialogDescription className="text-zinc-500 font-medium text-sm leading-relaxed">
                {t('imageBlockedDesc')}
                {item?.moderation_result && (
                  <span className="mt-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold text-xs uppercase italic block">
                    &quot;{t(item.moderation_result)}&quot;
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
