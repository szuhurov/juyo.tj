"use client";

import { useEffect, useState, use } from "react";
import { Item, ItemService } from "@/lib/services/item-service";
import { useLanguage } from "@/lib/language-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Phone, Eye, ArrowLeft, ShieldCheck, User, ChevronLeft, ChevronRight, Share2, Bookmark } from "lucide-react";
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

export default function ItemDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    loadItem();
    ItemService.incrementView(id);
    if (userId) {
      checkInitialSavedState();
    }
  }, [id, userId]);

  const checkInitialSavedState = async () => {
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) return;
      
      const supabase = createClerkSupabaseClient(token);
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
      const saved = await ItemService.toggleSaveItem(supabase, userId!, id);
      setIsSaved(saved);
      toast.success(saved ? "Ба захирашудаҳо илова шуд" : "Аз захирашудаҳо нест шуд");
      
      // Dispatch a custom event to notify other components (like ProfilePage)
      window.dispatchEvent(new Event('saved-items-updated'));
    } catch (e) {
      console.error("Error toggling save in DB:", e);
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

  const loadItem = async () => {
    try {
      const data = await ItemService.getItemDetails(id);
      setItem(data);
    } catch (error) {
      console.error("Error loading item:", error);
      toast.error(t('itemNotFound'));
    } finally {
      setLoading(false);
    }
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
        <Button variant="ghost" asChild className="mb-6 gap-2 rounded-md font-bold">
          <Link href="/">
            <ArrowLeft className="w-4 h-4" /> {t('home')}
          </Link>
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          {/* Images Carousel - Sticky on Desktop */}
          <div className="md:sticky md:top-24 space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-2xl border shadow-md bg-zinc-100 dark:bg-zinc-900 group">
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
              
              {/* Carousel Controls */}
              {images.length > 1 && (
                <>
                  <button 
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm border border-zinc-200 flex items-center justify-center text-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm border border-zinc-200 flex items-center justify-center text-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                  
                  {/* Indicators */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          i === currentImageIndex ? "w-6 bg-white shadow-sm" : "w-1.5 bg-white/50"
                        )}
                      />
                    ))}
                  </div>
                </>
              )}

              <Badge 
                className={cn(
                  "absolute top-4 left-4 uppercase font-black rounded-md px-3 py-1 shadow-sm border-none z-10",
                  item.type === 'lost' 
                    ? "bg-red-600 text-white hover:bg-red-700" 
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                )}
              >
                {item.type === 'lost' ? t('lost') : t('found')}
              </Badge>
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  {item.profiles?.avatar_url ? (
                    <Image src={item.profiles.avatar_url} alt="User" width={44} height={44} className="object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-zinc-400" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm leading-tight">
                    {item.profiles?.first_name || t('user')} {item.profiles?.last_name || ""}
                  </p>
                  <p className="text-[9px] text-zinc-400 font-black uppercase tracking-tighter mt-0.5">
                    {t('ownerInfo')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold mr-2">
                  <Eye className="w-4 h-4" /> {item.views || 0}
                </div>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-zinc-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={handleShare}>
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Мубодила</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "h-9 w-9 rounded-xl transition-colors",
                        isSaved 
                          ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" 
                          : "text-zinc-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                      )} 
                      onClick={toggleSave}
                      disabled={isToggling}
                    >
                      <Bookmark className={cn("w-4 h-4 transition-all", isSaved && "fill-emerald-500 text-emerald-500")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isSaved ? "Бардоштан аз захира" : "Захира кардан"}</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="flex items-start mb-4">
              <Badge variant="outline" className="uppercase tracking-widest text-[10px] rounded-md px-2 py-0.5">
                {t(`categories.${item.category}`)}
              </Badge>
            </div>

            <h1 className="text-3xl font-black tracking-tight mb-2 uppercase">{item.title}</h1>
            
            <div className="flex items-center gap-2 text-zinc-500 mb-8 text-sm font-medium">
              <Calendar className="w-4 h-4" />
              <span>{item.created_at ? format(new Date(item.created_at), "dd.MM.yyyy") : ""}</span>
            </div>

            {item.reward && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-yellow-400 rounded-md p-4 mb-8">
                <p className="text-yellow-800 dark:text-yellow-400 font-bold text-[10px] uppercase tracking-wider mb-1">
                  {t('reward')}
                </p>
                <p className="text-2xl font-black text-yellow-900 dark:text-yellow-100">
                  {item.reward} TJS
                </p>
              </div>
            )}

            <div className="mb-8">
              <h3 className="font-black text-sm uppercase tracking-wider text-zinc-400 mb-3">{t('description')}</h3>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-base whitespace-pre-wrap font-medium">
                {item.description}
              </p>
            </div>

            {/* Safety Tips */}
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 mb-8 flex gap-4 items-start border border-blue-100 dark:border-blue-900/30">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs text-blue-900 dark:text-blue-400">{t('safetyTitle')}</p>
                <p className="text-[10px] text-blue-700 dark:text-blue-500 font-medium leading-tight mt-1">{t('safetyText')}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="lg" className="h-14 w-full rounded-xl text-base font-black gap-3 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-100 dark:shadow-none" asChild>
                    <a href={`tel:${item.phone_number}`}>
                      <Phone className="w-5 h-5" /> {t('call')}
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('call')} {item.phone_number}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
