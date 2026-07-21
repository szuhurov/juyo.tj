/**
 * Ин қисми клиентии саҳифаи тафсилоти эълон ҳаст.
 * Тамоми логикаи интерактивӣ (тугмаҳо, карусел ва ғайра) дар ин ҷост.
 */ "use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Item, ItemService } from "@/lib/services/item-service";
import { useLanguage } from "@/lib/language-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Phone,
  Eye,
  User,
  ChevronLeft,
  ChevronRight,
  Share2,
  Bookmark,
  Pencil,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { VerifiedBadge } from "@/components/verified-badge";

export default function ItemDetailsClient({
  id,
  initialItem,
}: {
  id: string;
  initialItem?: Item | null;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const { getToken, userId, isLoaded } = useAuth();
  const queryClient = useQueryClient();

  // undefined = Clerk ҳанӯз auth-ро санҷидааст, null = вуруд накарда, string = вуруд кардааст
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const viewIncremented = useRef(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResolvedConfirm, setShowResolvedConfirm] = useState(false);
  const [showBlockedInfo, setShowBlockedInfo] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      getToken({ template: "supabase" }).then(setToken);
    }
  }, [isLoaded, getToken]);

  const { data: item, isLoading: loading } = useItemDetails(
    id,
    token,
    initialItem,
  );
  const isOwner = !!userId && userId === item?.user_id;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isManualScroll = useRef(false);

  const goToPrev = () => {
    const prevIndex = (currentImageIndex - 1 + images.length) % images.length;
    scrollContainerRef.current?.scrollTo({
      left: prevIndex * scrollContainerRef.current.clientWidth,
      behavior: "smooth",
    });
  };

  const goToNext = () => {
    const nextIndex = (currentImageIndex + 1) % images.length;
    scrollContainerRef.current?.scrollTo({
      left: nextIndex * scrollContainerRef.current.clientWidth,
      behavior: "smooth",
    });
  };

  // Агар маълумот дар кэш бошад (аз саҳифаи асосӣ), онро фавран истифода мебарем
  const images =
    item?.images && item.images.length > 0
      ? item.images
      : item
        ? [
            {
              image_url: "https://placehold.co/600x600/e2e8f0/64748b?text=JUYO",
            },
          ]
        : [];

  // Эффект барои автоматикӣ иваз шудани суратҳо
  useEffect(() => {
    if (!isAutoPlaying || images.length <= 1 || !scrollContainerRef.current)
      return;

    const interval = setInterval(() => {
      if (isManualScroll.current) return;

      const nextIndex = (currentImageIndex + 1) % images.length;
      const container = scrollContainerRef.current;

      if (container) {
        const width = container.clientWidth;
        container.scrollTo({
          left: nextIndex * width,
          behavior: "smooth",
        });
      }
    }, 4000); // Ҳар 4 сония иваз мешавад

    return () => clearInterval(interval);
  }, [isAutoPlaying, images.length, currentImageIndex]);

  useEffect(() => {
    if (isLoaded && item && !viewIncremented.current) {
      const isActuallyOwner = userId === item.user_id;
      if (!isActuallyOwner) {
        const sessionKey = `viewed_${id}`;
        if (!sessionStorage.getItem(sessionKey)) {
          viewIncremented.current = true;
          ItemService.incrementView(id).then(() => {
            sessionStorage.setItem(sessionKey, "true");
            queryClient.setQueryData(["items", "detail", id], (old: Item | undefined) => {
              if (!old) return old;
              return { ...old, views: (old?.views || 0) + 1 };
            });
          });
        }
      }
      viewIncremented.current = true;
    }
  }, [id, userId, isLoaded, item, queryClient]);

  const checkInitialSavedState = useCallback(async () => {
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);
      const { data } = await supabase
        .from("saved_items")
        .select("item_id")
        .eq("user_id", userId)
        .eq("item_id", id)
        .maybeSingle();
      setIsSaved(!!data);
    } catch {
      setIsSaved(false);
    }
  }, [getToken, userId, id]);

  useEffect(() => {
    if (userId && id) {
      checkInitialSavedState();
    }
  }, [id, userId, checkInitialSavedState]);

  useEffect(() => {
    if (isLoaded && item && isOwner && item.moderation_status === "rejected") {
      setShowBlockedInfo(true);
    }
  }, [isLoaded, item, isOwner]);

  const toggleSave = async () => {
    if (!userId) {
      toast.info(t("pleaseLogin"));
      router.push("/sign-up");
      return;
    }
    if (isToggling) return;
    setIsToggling(true);
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token!);
      const saved = await ItemService.toggleSaveItem(supabase, userId!, id);
      setIsSaved(saved);
      toast.success(saved ? t("addedToSaved") : t("removedFromSaved"));
      queryClient.invalidateQueries({ queryKey: ["items", "saved", userId] });
    } catch {
      toast.error(t("error"));
    } finally {
      setIsToggling(false);
    }
  };

  const handleShare = () => {
    const shareData = {
      title: item?.title,
      text: item?.description,
      url: window.location.href,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(console.error);
    } else if (
      typeof window !== "undefined" &&
      window.ReactNativeWebView
    ) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: "SHARE", payload: shareData }),
      );
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success(t("success"));
    }
  };

  const handleDelete = async () => {
    setIsActionLoading(true);
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token!);
      await ItemService.deleteItem(supabase, id);
      toast.success(t("success"));
      router.push("/");
    } catch {
      toast.error(t("error"));
    } finally {
      setIsActionLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleResolved = async () => {
    setIsActionLoading(true);
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token!);
      await ItemService.deleteItem(supabase, id);
      toast.success(t("itemResolvedSuccess"));
      router.push("/");
    } catch {
      toast.error(t("error"));
    } finally {
      setIsActionLoading(false);
      setShowResolvedConfirm(false);
    }
  };

  if (!item) {
    // Skeleton нишон медиҳем агар: auth ҳанӯз муайян нашудааст ё query кор мекунад
    if (token === undefined || loading) {
      return (
        <div className="mx-auto max-w-6xl md:pt-8 px-4 py-4 md:px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-12">
            <Skeleton className="w-full aspect-square rounded-[32px]" />
            <div className="space-y-6 pt-10 md:pt-0">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <div className="flex gap-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <Skeleton className="h-12 w-12 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      );
    }
    // Танҳо пас аз тайёр шудани auth ва анҷоми query"ёфт нашуд"нишон медиҳем
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">{t("itemNotFound")}</h1>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-6xl md:pt-8 md:px-4">
        <div className="flex flex-col md:grid md:grid-cols-2 gap-0 md:gap-12 md:items-start relative">
          <div className="sticky top-0 md:top-24 z-0 w-full h-[100vw] md:h-auto md:aspect-square flex items-start justify-center md:self-start">
            <div className="relative w-full h-full md:rounded-[32px] overflow-hidden border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 md:shadow-xl group shimmer-bg">
              <div
                ref={scrollContainerRef}
                className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                onScroll={(e) => {
                  const scrollLeft = (e.target as HTMLDivElement).scrollLeft;
                  const width = (e.target as HTMLDivElement).clientWidth;
                  const index = Math.round(scrollLeft / width);
                  if (index !== currentImageIndex) {
                    setCurrentImageIndex(index);
                  }
                }}
                onTouchStart={() => {
                  isManualScroll.current = true;
                  setIsAutoPlaying(false);
                }}
              >
                {images.map((img, index) => (
                  <div
                    key={index}
                    className="h-full w-full shrink-0 snap-center relative"
                  >
                    <Image
                      src={img.image_url}
                      alt={item?.title || "JUYO Item"}
                      fill
                      className="object-contain"
                      priority={index === 0}
                      quality={90}
                    />
                  </div>
                ))}
              </div>

              {images.length > 1 && (
                <>
                  <button
                    onClick={goToPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={goToNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {images.length > 1 && (
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
                  {images.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300 shadow-sm",
                        i === currentImageIndex
                          ? "bg-white w-4"
                          : "bg-white/40 w-1.5",
                      )}
                    />
                  ))}
                </div>
              )}

              {images.length > 1 && (
                <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full z-20 pointer-events-none">
                  <p className="text-[10px] font-black text-white tracking-widest">
                    {currentImageIndex + 1} / {images.length}
                  </p>
                </div>
              )}

              <Badge
                className={cn(
                  "absolute top-4 left-4 font-black rounded-md px-3 py-1 shadow-md border-none z-10",
                  item?.type === "lost"
                    ? "bg-red-600 text-white"
                    : "bg-emerald-700 text-white",
                )}
              >
                {item?.type === "lost" ? t("lost") : t("found")}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col relative z-10 bg-white dark:bg-zinc-950 rounded-t-xl md:rounded-none -mt-8 md:mt-0 px-5 pt-10 md:px-0 md:pt-0 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-none">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
              {item?.profiles ? (
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 border border-zinc-200 shadow-sm">
                    <AvatarImage src={item.profiles?.avatar_url ?? undefined} alt="User" />
                    <AvatarFallback className="bg-zinc-50 dark:bg-zinc-900">
                      <User className="w-6 h-6 text-zinc-400" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="font-black text-sm leading-tight flex items-center gap-1">
                      {item.profiles?.first_name || t("user")}
                      {item.profiles?.is_verified && <VerifiedBadge />}
                    </p>
                    {item.profiles?.last_name && (
                      <p className="text-[10px] text-zinc-500 font-bold tracking-tight">
                        {item.profiles.last_name}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-black">
                <Eye className="w-4 h-4" /> {item?.views || 0}
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tighter leading-none mb-3">
              {item?.title}
            </h1>
            <Badge
              className={cn(
                "font-black rounded-md px-3 py-1 shadow-md border-none mb-6 w-fit text-sm",
                item?.type === "lost"
                  ? "bg-red-600 text-white"
                  : "bg-emerald-700 text-white",
              )}
            >
              {item?.type === "lost" ? t("lost") : t("found")}
            </Badge>

            {item?.type === "lost" && item.reward && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 rounded-xl p-3 mb-8 shadow-sm">
                <p className="text-emerald-600 font-black text-[9px] mb-0.5">
                  {t("reward_gives_viewer")}
                </p>
                <p className="text-xl font-black text-emerald-900 dark:text-emerald-100">
                  {item.reward} TJS
                </p>
              </div>
            )}

            <div className="mb-8">
              <h2 className="font-black text-[10px] text-zinc-500 mb-4">
                {t("description")}
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-base whitespace-pre-wrap font-medium">
                {item?.description}
              </p>
            </div>

            <div className="flex flex-row items-center gap-2 mb-10">
              {isLoaded && isOwner && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label={t("edit")}
                    className="flex-1 h-12 md:h-16 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm"
                    asChild
                  >
                    <Link href={`/items/${id}/edit`}>
                      <Pencil className="w-5 h-5 md:w-7 md:h-7" />
                    </Link>
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label={t("delete")}
                    className="flex-1 h-12 md:h-16 rounded-lg bg-red-50 dark:bg-red-900/10 text-red-600 border border-red-100/50 shadow-sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isActionLoading}
                  >
                    <Trash2 className="w-5 h-5 md:w-7 md:h-7" />
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                size="icon"
                aria-label={t("share")}
                className="flex-1 h-12 md:h-16 rounded-lg bg-blue-50 dark:bg-blue-900/10 text-blue-600 border border-blue-100/50 shadow-sm"
                onClick={handleShare}
              >
                <Share2 className="w-5 h-5 md:w-7 md:h-7" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label={isSaved ? t("removedFromSaved") : t("addedToSaved")}
                className={cn(
                  "flex-1 h-12 md:h-16 rounded-lg transition-all border shadow-sm",
                  isSaved
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                    : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100",
                )}
                onClick={toggleSave}
                disabled={isToggling}
              >
                <Bookmark
                  className={cn(
                    "w-5 h-5 md:w-7 md:h-7",
                    isSaved && "fill-emerald-600",
                  )}
                />
              </Button>
            </div>

            <div className="mt-auto flex flex-col gap-3">
              {isLoaded && isOwner ? (
                <Button
                  size="lg"
                  className="h-14 md:h-16 w-full rounded-2xl font-black bg-emerald-700 hover:bg-emerald-800 text-white shadow-lg"
                  onClick={() => setShowResolvedConfirm(true)}
                  disabled={isActionLoading}
                >
                  <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 mr-2" />{" "}
                  {t("resolved")}?
                </Button>
              ) : item?.phone_number ? (
                <Button
                  size="lg"
                  className="h-14 md:h-16 w-full rounded-2xl font-black bg-zinc-900 hover:bg-zinc-800 text-white shadow-lg"
                  asChild
                >
                  <a href={`tel:${item.phone_number}`}>
                    <Phone className="w-5 h-5 md:w-6 md:h-6 mr-2" /> {t("call")}
                  </a>
                </Button>
              ) : (
                <div className="h-14 md:h-16 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center gap-2 text-zinc-400 font-bold text-sm text-center px-4">
                  <Phone className="w-5 h-5 shrink-0" /> {t("phoneNotAvailable")}
                </div>
              )}
            </div>
          </div>
        </div>

        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="rounded-3xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-red-600 font-black">
                {t("deleteConfirm")}
              </DialogTitle>
            </DialogHeader>
            <DialogFooter className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isActionLoading}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isActionLoading}
              >
                {isActionLoading && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                {t("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={showResolvedConfirm}
          onOpenChange={setShowResolvedConfirm}
        >
          <DialogContent className="rounded-3xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-emerald-600 font-black">
                {t("resolved")}?
              </DialogTitle>
            </DialogHeader>
            <DialogDescription className="text-zinc-500 font-medium">
              {t("resolvedConfirmDesc")}
            </DialogDescription>
            <DialogFooter className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowResolvedConfirm(false)}
                disabled={isActionLoading}
              >
                {t("cancel")}
              </Button>
              <Button
                className="bg-emerald-600"
                onClick={handleResolved}
                disabled={isActionLoading}
              >
                {isActionLoading && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                {t("resolved")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={showBlockedInfo} onOpenChange={setShowBlockedInfo}>
          <DialogContent className="sm:max-w-md rounded-[1.75rem] p-6 gap-5 border-none shadow-2xl">
            <DialogHeader className="space-y-2.5">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-1 bg-red-50 dark:bg-red-900/20 text-red-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <DialogTitle className="text-lg font-black tracking-tight text-red-600 leading-snug">
                {item?.moderation_result?.startsWith("mod_offensive_text")
                  ? t("textBlockedTitle")
                  : t("imageBlockedTitle")}
              </DialogTitle>
              <div className="text-zinc-500 font-bold text-sm leading-relaxed">
                <p className="mb-4">
                  {item?.moderation_result?.startsWith("mod_offensive_text")
                    ? t("textBlockedDesc")
                    : t("imageBlockedDesc")}
                </p>
                {item?.moderation_result && (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-black text-xs italic">
                    {item.moderation_result.includes(":") ? (
                      <p>
                        {t(item.moderation_result.split(":")[0])}:{" "}
                        <span className="text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                          {item.moderation_result.split(":")[1]}
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
                className="w-full h-12 rounded-xl font-black tracking-widest text-[10px] bg-zinc-900 hover:bg-zinc-800 text-white"
                onClick={() => setShowBlockedInfo(false)}
              >
                {t("ok")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
