/**
 * This is the client-side part of the item details page.
 * All interactive logic (buttons, carousel, etc.) lives here.
 */ "use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Item, ItemService, UNSPECIFIED_REWARD } from "@/lib/services/item-service";
import { useLanguage } from "@/lib/language-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Phone,
  Eye,
  User,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Share2,
  Bookmark,
  Pencil,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  Store,
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
import { ImagePlaceholder } from "@/components/image-placeholder";
import { TelegramIcon, WhatsappIcon, socialHref } from "@/components/social-icons";

/**
 * `item.phone_number` is a local number only (no country code). Telegram/
 * WhatsApp, on the other hand, require the international number — so we add
 * the "992" code, but if it's already there (old data), we don't duplicate it.
 */
function toIntlPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("992") ? digits : `992${digits}`;
}

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

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const viewIncremented = useRef(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResolvedConfirm, setShowResolvedConfirm] = useState(false);
  const [showBlockedInfo, setShowBlockedInfo] = useState(false);

  const { data: item, isLoading: loading } = useItemDetails(
    id,
    isLoaded ? !!userId : undefined,
    getToken,
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

  // If the data is already cached (from the home page), use it immediately
  // No image: instead of an external placehold.co URL (an extra network
  // request and a dependency on a third-party service), the list stays empty
  // and a local placeholder (ImagePlaceholder) is shown at render time.
  const images = item?.images && item.images.length > 0 ? item.images : [];

  // Effect for automatically cycling through images
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
    }, 4000); // Changes every 4 seconds

    return () => clearInterval(interval);
  }, [isAutoPlaying, images.length, currentImageIndex]);

  useEffect(() => {
    if (isLoaded && item && !viewIncremented.current) {
      const isActuallyOwner = userId === item.user_id;
      if (!isActuallyOwner) {
        // `localStorage`, not `sessionStorage`: a session ends when the tab
        // closes, and the same person would add another +1 on their second
        // visit. The count must happen only ONCE per person.
        const viewKey = `viewed_${id}`;
        if (!localStorage.getItem(viewKey)) {
          viewIncremented.current = true;
          ItemService.incrementView(id).then(() => {
            localStorage.setItem(viewKey, "true");
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
      const supabase = createClerkSupabaseClient(getToken);
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
      const supabase = createClerkSupabaseClient(getToken);
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
      const res = await fetch(`/api/items/${id}/delete`, { method: "POST" });
      if (!res.ok) throw new Error();
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
      const supabase = createClerkSupabaseClient(getToken);
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
    // We show the skeleton if: auth isn't determined yet, or the query is still running
    if (!isLoaded || loading) {
      return (
        <div className="mx-auto max-w-6xl md:pt-8 px-2.5 py-4 md:px-4">
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
    // Only show "not found" after auth is ready and the query has finished
    return (
      <div className="container mx-auto px-2.5 sm:px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">{t("itemNotFound")}</h1>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-canvas mx-auto max-w-6xl md:pt-8 md:px-4 -mb-20 pb-20 md:mb-0 md:pb-0">
        <div className="flex flex-col md:grid md:grid-cols-2 gap-0 md:gap-12 md:items-start relative">
          <div className="sticky top-0 md:top-8 z-0 w-full h-[100vw] md:h-auto md:aspect-square flex items-start justify-center md:self-start">
            <div className="relative w-full h-full md:rounded-[32px] overflow-hidden border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 group shimmer-bg">
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
                {images.length === 0 && !loading && (
                  <div className="h-full w-full shrink-0 relative">
                    <ImagePlaceholder />
                  </div>
                )}
                {images.map((img, index) => (
                  <div
                    key={index}
                    className="h-full w-full shrink-0 snap-center relative overflow-hidden"
                  >
                    {/* Background — the same image, scaled up and blurred, so that the
                        empty space of the canvas (if the aspect ratio doesn't match
                        the image) gets filled with the image's own color context,
                        rather than a flat color (like Instagram Stories). */}
                    {/* Bottom layer — so the slide isn't empty while the image loads. */}
                    <ImagePlaceholder />
                    <Image
                      src={img.image_url}
                      alt=""
                      aria-hidden="true"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover scale-110 blur-2xl opacity-70"
                      priority={index === 0}
                      quality={20}
                    />
                    <Image
                      src={img.image_url}
                      alt={item?.title || "JUYO Item"}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="relative z-10 object-contain"
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
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/40 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={goToNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/40 transition-colors"
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
                <div className="absolute top-4 right-4 bg-black/20 backdrop-blur-md px-3 py-1 rounded-full z-20 pointer-events-none">
                  <p className="text-[10px] font-semibold text-white tracking-widest">
                    {currentImageIndex + 1} / {images.length}
                  </p>
                </div>
              )}

              <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.back()}
                  aria-label={t("back")}
                  className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/40 transition-colors shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <Badge
                  className={cn(
                    "font-semibold rounded-md px-3 py-1 border-none bg-white dark:bg-zinc-800",
                    item?.type === "lost"
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {item?.type === "lost" ? t("lost") : t("found")}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-col relative z-10 bg-canvas rounded-t-3xl md:rounded-none -mt-8 md:mt-0 px-5 pt-10 md:px-0 md:pt-0 pb-12">
            {/* Drag handle — like an iOS/mobile app's bottom sheet,
                indicating that this panel can be dragged up and down. */}
            <div className="md:hidden flex justify-center -mt-6 mb-4">
              <div className="w-10 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            </div>
            {/* Divider line between the listing owner and the item info — it
                separates these two content sections from each other. */}
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              {item?.profiles ? (
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 min-[1084px]:w-14 min-[1084px]:h-14 min-[1920px]:w-16 min-[1920px]:h-16 border border-zinc-200">
                    <AvatarImage src={item.profiles?.avatar_url ?? undefined} alt="User" />
                    <AvatarFallback className="bg-zinc-50 dark:bg-zinc-800">
                      <User className="w-6 h-6 min-[1084px]:w-7 min-[1084px]:h-7 min-[1920px]:w-8 min-[1920px]:h-8 text-zinc-400" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="font-semibold text-base min-[1084px]:text-lg min-[1920px]:text-xl leading-tight flex items-center gap-1">
                      {item.profiles?.first_name || t("user")}
                      {item.profiles?.is_verified && <VerifiedBadge />}
                    </p>
                    {item.profiles?.last_name && (
                      <p className="text-xs min-[1084px]:text-[13px] min-[1920px]:text-sm text-zinc-500 font-medium tracking-tight">
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
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-zinc-500 text-xs min-[1084px]:text-sm font-medium">
                  <Eye className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] min-[1920px]:w-5 min-[1920px]:h-5" /> {item?.views || 0}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mb-3">
              <h1 className="min-w-0 truncate text-2xl min-[1503px]:text-3xl font-bold tracking-tighter leading-none">
                {item?.title}
              </h1>
              <Badge
                className={cn(
                  "shrink-0 font-semibold rounded-md px-3 py-1 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700",
                  item?.type === "lost"
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {item?.type === "lost" ? t("lost") : t("found")}
              </Badge>
            </div>

            <div className="mb-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="font-semibold text-base min-[1084px]:text-lg min-[1503px]:text-xl text-zinc-500">
                  {t("description")}
                </h2>
                {item?.type === "lost" && item.reward && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 min-[1084px]:px-4 min-[1084px]:py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-emerald-700 dark:text-emerald-400 text-sm min-[1503px]:text-base font-semibold">
                    {item.reward === UNSPECIFIED_REWARD
                      ? t("reward_unspecified_viewer")
                      : `${t("reward_gives_viewer")} ${item.reward} TJS`}
                  </span>
                )}
              </div>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-base min-[1084px]:text-lg min-[1503px]:text-xl whitespace-pre-wrap font-medium">
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
                    className="flex-1 h-12 md:h-16 min-[1084px]:h-[70px] min-[1920px]:h-20 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800"
                    asChild
                  >
                    <Link href={`/items/${id}/edit`}>
                      <Pencil className="w-5 h-5 md:w-7 md:h-7 min-[1084px]:w-8 min-[1084px]:h-8 min-[1920px]:w-9 min-[1920px]:h-9" />
                    </Link>
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label={t("delete")}
                    className="flex-1 h-12 md:h-16 min-[1084px]:h-[70px] min-[1920px]:h-20 rounded-lg bg-red-50 dark:bg-red-900/10 text-red-600 border border-red-100/50"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isActionLoading}
                  >
                    <Trash2 className="w-5 h-5 md:w-7 md:h-7 min-[1084px]:w-8 min-[1084px]:h-8 min-[1920px]:w-9 min-[1920px]:h-9" />
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                size="icon"
                aria-label={t("share")}
                className="flex-1 h-12 md:h-16 min-[1084px]:h-[70px] min-[1920px]:h-20 rounded-lg bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                onClick={handleShare}
              >
                <Share2 className="w-5 h-5 md:w-7 md:h-7 min-[1084px]:w-8 min-[1084px]:h-8 min-[1920px]:w-9 min-[1920px]:h-9" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label={isSaved ? t("removedFromSaved") : t("addedToSaved")}
                className="flex-1 h-12 md:h-16 min-[1084px]:h-[70px] min-[1920px]:h-20 rounded-lg bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 transition-all"
                onClick={toggleSave}
                disabled={isToggling}
              >
                <Bookmark
                  className={cn(
                    "w-5 h-5 md:w-7 md:h-7 min-[1084px]:w-8 min-[1084px]:h-8 min-[1920px]:w-9 min-[1920px]:h-9",
                    isSaved && "fill-emerald-600",
                  )}
                />
              </Button>
            </div>

            {item?.handoff_type === "nearby" && (
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Store className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    {t("handoffCardTitle")}
                  </span>
                </div>
                {item.handoff_photo_url && (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden bg-white dark:bg-zinc-800">
                    <Image
                      src={item.handoff_photo_url}
                      alt={t("handoffCardTitle")}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto flex flex-col gap-3">
              {isLoaded && isOwner ? (
                <Button
                  size="lg"
                  className="h-14 md:h-16 min-[1084px]:h-[70px] min-[1920px]:h-20 w-full rounded-2xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => setShowResolvedConfirm(true)}
                  disabled={isActionLoading}
                >
                  <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 min-[1084px]:w-7 min-[1084px]:h-7 min-[1920px]:w-8 min-[1920px]:h-8 mr-2" />{" "}
                  {t("resolved")}?
                </Button>
              ) : item?.phone_number ? (
                <div className="flex gap-3">
                  <Button
                    size="lg"
                    className="flex-1 min-w-0 h-14 md:h-16 min-[1084px]:h-[70px] min-[1920px]:h-20 rounded-2xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white px-2"
                    asChild
                  >
                    <a href={`tel:${item.phone_number}`}>
                      <Phone className="w-5 h-5 md:w-6 md:h-6 min-[1084px]:w-7 min-[1084px]:h-7 min-[1920px]:w-8 min-[1920px]:h-8 mr-2 shrink-0" />
                      <span className="truncate">{t("call")}</span>
                    </a>
                  </Button>
                  {item.contact_telegram && socialHref("telegram", toIntlPhone(item.phone_number)) && (
                    <Button
                      size="lg"
                      variant="secondary"
                      className="flex-1 min-w-0 h-14 md:h-16 min-[1084px]:h-[70px] min-[1920px]:h-20 rounded-2xl font-bold bg-white dark:bg-zinc-800 text-[#229ED9] border border-zinc-200 dark:border-zinc-700 px-2"
                      asChild
                    >
                      <a
                        href={socialHref("telegram", toIntlPhone(item.phone_number))!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <TelegramIcon size={24} className="mr-2 shrink-0" />
                        <span className="truncate">Telegram</span>
                      </a>
                    </Button>
                  )}
                  {item.contact_whatsapp && socialHref("whatsapp", toIntlPhone(item.phone_number)) && (
                    <Button
                      size="lg"
                      variant="secondary"
                      className="flex-1 min-w-0 h-14 md:h-16 min-[1084px]:h-[70px] min-[1920px]:h-20 rounded-2xl font-bold bg-white dark:bg-zinc-800 text-[#25D366] border border-zinc-200 dark:border-zinc-700 px-2"
                      asChild
                    >
                      <a
                        href={socialHref("whatsapp", toIntlPhone(item.phone_number))!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <WhatsappIcon size={24} className="mr-2 shrink-0" />
                        <span className="truncate">WhatsApp</span>
                      </a>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="h-14 md:h-16 min-[1084px]:h-[70px] min-[1920px]:h-20 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center gap-2 text-zinc-400 font-semibold text-sm min-[1503px]:text-base text-center px-4">
                  <Phone className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 shrink-0" /> {t("phoneNotAvailable")}
                </div>
              )}
            </div>
          </div>
        </div>

        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="rounded-3xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-red-600 font-bold">
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
              <DialogTitle className="text-emerald-600 font-bold">
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
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
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
          <DialogContent className="sm:max-w-md rounded-2xl p-6 gap-5 border-none shadow-2xl">
            <DialogHeader className="space-y-2.5">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-1 bg-red-50 dark:bg-red-900/20 text-red-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <DialogTitle className="text-lg font-bold tracking-tight text-red-600 leading-snug">
                {item?.moderation_result?.startsWith("mod_offensive_text")
                  ? t("textBlockedTitle")
                  : t("imageBlockedTitle")}
              </DialogTitle>
              <div className="text-zinc-500 font-medium text-sm leading-relaxed">
                <p className="mb-4">
                  {item?.moderation_result?.startsWith("mod_offensive_text")
                    ? t("textBlockedDesc")
                    : t("imageBlockedDesc")}
                </p>
                {item?.moderation_result && (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium text-xs italic">
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
                className="w-full h-12 rounded-xl font-semibold tracking-widest text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white"
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
