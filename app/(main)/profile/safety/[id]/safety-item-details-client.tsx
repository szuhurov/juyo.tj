/**
 * Ин қисми клиентии саҳифаи тафсилоти ашё аз Safety Box ҳаст.
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { ItemService, CATEGORIES } from "@/lib/services/item-service";
import { useLanguage } from "@/lib/language-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar, Phone, Eye, ArrowLeft, User, 
  ChevronLeft, ChevronRight, Send, Pencil, 
  Trash2, Loader2, PackageSearch, CheckCircle2,
  ShieldCheck, ShieldAlert
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth, useUser } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { useSafetyItemDetails } from "@/lib/hooks/use-items";
import { useQueryClient } from "@tanstack/react-query";

export default function SafetyItemDetailsClient({ id }: { id: string }) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { getToken, userId, isLoaded: authLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const queryClient = useQueryClient();
  
  const [token, setToken] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // AI Moderation States
  const [moderationStatus, setModerationStatus] = useState<'idle' | 'checking' | 'passed' | 'failed'>('idle');
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (authLoaded) {
      getToken({ template: 'supabase' }).then(setToken);
    }
  }, [authLoaded, getToken]);

  const { data: item, isLoading: loading } = useSafetyItemDetails(id, token);

  // Animation Logic for AI Moderation
  useEffect(() => {
    let interval: any;
    let timer: any;

    if (moderationStatus === 'checking') {
      const technicalSteps = [
        t('ai_steps.scanning_pixels'),
        t('ai_steps.detecting_features'),
        t('ai_steps.checking_safety'),
        t('ai_steps.matching_categories'),
        t('ai_steps.optimizing_description'),
        t('ai_steps.forensic_engine')
      ];

      setScanMessage(t('ai_steps.brain_started'));
      
      let stepCount = 0;
      interval = setInterval(() => {
        stepCount++;
        if (stepCount % 6 === 3) {
          setScanMessage(t('ai_steps.please_wait'));
        } else if (stepCount % 6 === 0) {
          setScanMessage(t('ai_steps.do_not_exit'));
        } else {
          const techIndex = (Math.floor(stepCount / 2)) % technicalSteps.length;
          setScanMessage(technicalSteps[techIndex]);
        }
      }, 3000);

      timer = setInterval(() => {
        setElapsedSeconds(prev => Math.min(prev + 1, 120));
      }, 1000);

    } else {
      setElapsedSeconds(0);
      setScanMessage("");
    }
    
    return () => {
      if (interval) clearInterval(interval);
      if (timer) clearInterval(timer);
    };
  }, [moderationStatus, t]);

  const handlePublish = async () => {
    if (!item) return;

    // 1. Омода кардани AI Moderation
    const needsTextModeration = !item.text_moderated;
    const needsImageModeration = !item.images_moderated;

    // Агар ҳарду қисм аллакай тасдиқ шуда бошанд, модерацияро гузаронида нашр мекунем
    if (!needsTextModeration && !needsImageModeration) {
      setIsActionLoading(true);
      try {
        const supabaseToken = await getToken({ template: "supabase" });
        const supabase = createClerkSupabaseClient(supabaseToken!);
        
        const publishedItem = await ItemService.publishFromSafetyBox(supabase, item, userId!, 'approved');
        
        supabase.functions.invoke('generate-embedding', {
          body: { item_id: publishedItem.id, text: `${publishedItem.title} ${publishedItem.description}` }
        }).catch(err => console.error("Background embedding failed:", err));

        toast.success(t("success"));
        router.push('/profile?tab=posts');
      } catch (err) {
        toast.error(t("error"));
      } finally {
        setIsActionLoading(false);
      }
      return;
    }

    setModerationStatus('checking');
    setModerationError(null);
    setElapsedSeconds(0);
    
    try {
      const supabaseToken = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(supabaseToken!);

      // --- 1. МОДЕРАТСИЯИ МАТН ---
      if (needsTextModeration) {
        setScanMessage(t('ai_steps.checking_custom_text') || "AI матни шуморо месанҷад...");
        const { data: textData, error: textError } = await supabase.functions.invoke('text-moderation', {
          body: { 
            record: { title: item.item_name, description: item.description, moderation_status: 'pending' },
            lang: locale
          },
        });

        if (textError || (textData && textData.is_safe === false)) {
          setModerationStatus('failed');
          setModerationError(textData?.reason || t('ai_steps.text_moderation_failed'));
          return;
        }
        setScanMessage(t('ai_steps.text_passed'));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // --- 2. МОДЕРАТСИЯИ АКСҲО ---
      if (needsImageModeration) {
        setScanMessage(t('ai_steps.brain_started'));
        const formDataAI = new FormData();
        
        if (item.images && item.images.length > 0) {
          const imageFiles = await Promise.all(
            item.images.map(async (url: string, index: number) => {
              try {
                const response = await fetch(url);
                const blob = await response.blob();
                return new File([blob], `image-${index}.jpg`, { type: "image/jpeg" });
              } catch (e) { return null; }
            })
          );
          imageFiles.filter(Boolean).forEach((file) => formDataAI.append('image', file as File));
        }

        formDataAI.append('lang', locale);
        formDataAI.append('type', item.type || 'lost');
        formDataAI.append('mode', 'moderation_only'); 

        const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-brain', {
          body: formDataAI,
        });

        if (aiError || (aiResponse && aiResponse.is_safe === false)) {
          setModerationStatus('failed');
          setModerationError(aiResponse?.reason || aiError?.message || t('error'));
          return;
        }
        setScanMessage(t('ai_steps.images_passed'));
      }

      // 3. Нашр
      const publishedItem = await ItemService.publishFromSafetyBox(supabase, item, userId!, 'approved');

      supabase.functions.invoke('generate-embedding', {
        body: { item_id: publishedItem.id, text: `${publishedItem.title} ${publishedItem.description}` }
      }).catch(err => console.error("Background embedding failed:", err));

      setModerationStatus('passed');
      toast.success(t("imageModeration.submitted"));
      
      setTimeout(() => {
        setModerationStatus('idle');
        router.push('/profile?tab=posts');
      }, 2000);

    } catch (error: any) {
      setModerationStatus('failed');
      setModerationError(error.message || t('error'));
    }
  };

  const handleDelete = async () => {
    setIsActionLoading(true);
    try {
      const supabaseToken = await getToken({ template: 'supabase' });
      const supabase = createClerkSupabaseClient(supabaseToken!);

      // Нест кардани аксҳо
      if (item.images && item.images.length > 0) {
        const filePaths = item.images.map((urlStr: string) => {
          try {
            const url = new URL(urlStr);
            const pathParts = url.pathname.split("/public/items/");
            return pathParts.length > 1 ? pathParts[1] : null;
          } catch (e) {
            const parts = urlStr.split("/public/items/");
            return parts.length > 1 ? parts[1].split("?")[0] : null;
          }
        }).filter(Boolean) as string[];

        if (filePaths.length > 0) {
          await supabase.storage.from("items").remove(filePaths);
        }
      }

      await supabase.from("safety_box").delete().eq("id", id);
      toast.success(t('success'));
      router.push('/profile?tab=safety');
    } catch (e) { toast.error(t('error')); } finally { setIsActionLoading(false); setShowDeleteConfirm(false); }
  };

  if (loading && !item) {
    return (
      <div className="mx-auto max-w-6xl md:pt-8 px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-12">
          <Skeleton className="w-full aspect-square rounded-[32px]" />
          <div className="space-y-6 pt-10 md:pt-0">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!item && !loading) return <div className="container mx-auto px-4 py-20 text-center"><h1 className="text-2xl font-bold">{t('itemNotFound')}</h1></div>;

  const images = item.images && item.images.length > 0 ? item.images : ["https://placehold.co/600x600/e2e8f0/64748b?text=JUYO"];

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-6xl md:pt-8 md:px-4">
        <div className="flex flex-col md:grid md:grid-cols-2 gap-0 md:gap-12 md:items-start relative">
          
          {/* Image Section */}
          <div className="sticky top-0 md:top-24 z-0 w-full h-[100vw] md:h-auto md:aspect-square flex items-start justify-center md:self-start">
            <div className="relative w-full h-full md:rounded-[32px] overflow-hidden border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 md:shadow-xl group">
              <div className="flex h-full w-full overflow-hidden relative">
                <Image 
                  src={images[currentImageIndex]} 
                  alt={item.item_name} 
                  fill 
                  className="object-cover" 
                  priority
                />
                
                {images.length > 1 && (
                  <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4">
                    <Button 
                      size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-white/80 backdrop-blur"
                      onClick={() => setCurrentImageIndex(prev => prev === 0 ? images.length - 1 : prev - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-white/80 backdrop-blur"
                      onClick={() => setCurrentImageIndex(prev => prev === images.length - 1 ? 0 : prev + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {images.length > 1 && (
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 z-20">
                  {images.map((_: any, i: number) => (
                    <div key={i} className={cn("h-1.5 rounded-full transition-all duration-300", i === currentImageIndex ? "bg-white w-4" : "bg-white/40 w-1.5")} />
                  ))}
                </div>
              )}

              <Badge className={cn("absolute top-4 left-4 uppercase font-black rounded-md px-3 py-1 shadow-md border-none z-10", item.type === 'lost' ? "bg-red-600 text-white" : "bg-emerald-600 text-white")}>
                {item.type === 'lost' ? t('lost') : t('found')}
              </Badge>
              
              <Link href="/profile?tab=safety" className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur flex items-center justify-center text-white transition-all z-20">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* Details Section */}
          <div className="flex flex-col relative z-10 bg-white dark:bg-zinc-950 rounded-t-3xl md:rounded-none -mt-8 md:mt-0 px-5 pt-10 md:px-0 md:pt-0 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-none">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-200">
                  {user?.imageUrl ? <Image src={user.imageUrl} alt="User" width={48} height={48} className="object-cover" /> : <User className="w-6 h-6 text-zinc-400" />}
                </div>
                <div className="flex flex-col">
                  <p className="font-black text-sm leading-tight uppercase">{user?.firstName || t('user')}</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">{t('mySafeItem') || 'Ашёи ман дар архив'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-black uppercase"><Calendar className="w-4 h-4" /> {new Date(item.created_at).toLocaleDateString()}</div>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none mb-6">{item.item_name}</h1>
            
            <div className="flex flex-wrap gap-2 mb-8">
              <Badge variant="outline" className="bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-500 font-bold uppercase text-[10px] px-3 py-1">
                {t(`categories.${CATEGORIES.find(c => c.name === item.category)?.id || "6"}`)}
              </Badge>
              {item.reward && (
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 font-black uppercase text-[10px] px-3 py-1 border-none">
                  {t('reward')}: {item.reward} TJS
                </Badge>
              )}
            </div>

            <div className="mb-8">
              <h3 className="font-black text-[10px] uppercase text-zinc-400 mb-4">{t('description')}</h3>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-base whitespace-pre-wrap font-medium">{item.description}</p>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/20 mb-10 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-sm">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{t("phoneLabel")}</div>
                <div className="text-sm font-black text-blue-700 dark:text-blue-400">+{item.phone_number}</div>
              </div>
            </div>

            <div className="flex flex-row items-center gap-2.5 mb-10">
              <Button variant="secondary" size="icon" className="h-14 w-14 shrink-0 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm" asChild><Link href={`/profile?tab=safety&edit=${id}`}><Pencil className="w-6 h-6" /></Link></Button>
              <Button variant="secondary" size="icon" className="h-14 w-14 shrink-0 rounded-2xl bg-red-50 dark:bg-red-900/10 text-red-600 border border-red-100/50 shadow-sm" onClick={() => setShowDeleteConfirm(true)} disabled={isActionLoading}><Trash2 className="w-6 h-6" /></Button>
              <Button size="lg" className="h-14 flex-1 rounded-2xl font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg uppercase tracking-widest" onClick={handlePublish} disabled={isActionLoading}>
                <Send className="w-5 h-5 mr-2" /> {t('publish')}
              </Button>
            </div>
          </div>
        </div>

        {/* Delete Confirm Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="rounded-3xl border-none shadow-2xl">
            <DialogHeader><DialogTitle className="text-red-600 font-black uppercase">{t('deleteConfirmTitle')}</DialogTitle></DialogHeader>
            <DialogDescription>{t('removeFromSafeConfirm')}</DialogDescription>
            <DialogFooter className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowDeleteConfirm(false)} disabled={isActionLoading}>{t('cancel')}</Button>
              <Button variant="destructive" className="flex-1 rounded-xl" onClick={handleDelete} disabled={isActionLoading}>{isActionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{t('delete')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI Moderation Scan Dialog */}
        <Dialog open={moderationStatus !== 'idle'} onOpenChange={(open) => !open && moderationStatus !== 'checking' && setModerationStatus('idle')}>
          <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-zinc-950">
            <div className="p-10 space-y-6 text-center">
              <DialogTitle className="sr-only">AI Moderation</DialogTitle>
              {moderationStatus === 'checking' && (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="relative group w-full aspect-square max-w-[85vw] sm:max-w-[40vh] lg:max-w-[30vh]">
                    <div className="absolute -inset-4 bg-emerald-500/10 rounded-[3rem] blur-2xl opacity-50 animate-pulse"></div>
                    <div className="relative h-full w-full rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl bg-zinc-950/70 backdrop-blur-xl transition-all duration-700">
                      <div className="relative w-full h-full overflow-hidden">
                        {item?.images?.[0] && (
                          <>
                            <Image src={item.images[0]} alt="" fill className="object-cover blur-3xl opacity-40 scale-110" />
                            <Image src={item.images[0]} alt="Analyzing" fill className="object-contain opacity-60 transition-all duration-1000 relative z-10" />
                          </>
                        )}
                        <div className="absolute inset-0 z-20 pointer-events-none">
                          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_30px_rgba(16,185,129,0.5)] animate-scan-fast" />
                        </div>
                        <div className="absolute inset-0 opacity-90 animate-grid-scan z-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(52, 211, 153, 1) 1.5px, transparent 1.5px)", backgroundSize: "25px 25px" }} />
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">{t('ai_steps.seconds_left').replace('%{count}', elapsedSeconds.toString())}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="h-6 flex items-center justify-center">
                    <p className="text-emerald-600 font-black text-[10px] uppercase tracking-[0.2em] animate-in slide-in-from-bottom-2 duration-700">{scanMessage}</p>
                  </div>
                </div>
              )}
              {moderationStatus === 'failed' && (
                <div className="space-y-6 text-center animate-in zoom-in duration-300">
                  <div className="w-20 h-20 rounded-[2rem] bg-red-50 flex items-center justify-center mx-auto shadow-sm"><ShieldAlert className="w-10 h-10 text-red-500" /></div>
                  <div className="space-y-3">
                    <h2 className="text-xl font-black uppercase tracking-tight text-red-600">{t('ai_steps.step5_failed')}</h2>
                    <p className="text-red-700 font-bold text-sm leading-relaxed">{moderationError || t('error')}</p>
                    <Button variant="outline" onClick={() => setModerationStatus('idle')} className="w-full rounded-xl h-12 font-black uppercase text-[10px] text-red-600 border-red-200">
                      {t('close')}
                    </Button>
                  </div>
                </div>
              )}
              {moderationStatus === 'passed' && (
                <div className="space-y-6 animate-in zoom-in duration-300">
                  <div className="w-20 h-20 rounded-[2rem] bg-emerald-50 flex items-center justify-center mx-auto shadow-sm"><CheckCircle2 className="w-10 h-10 text-emerald-500" /></div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-black uppercase tracking-tight text-emerald-600">{t('success')}</h2>
                    <p className="text-zinc-500 font-bold text-sm">{t('imageModeration.submitted')}</p>
                  </div>
                </div>
              )}
            </div>
        </DialogContent>
      </Dialog>
    </div>
  </TooltipProvider>
  );
}
