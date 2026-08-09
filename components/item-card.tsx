"use client";

/**
 * Card-и эълон барои профил (Эълонҳои ман / Захирашуда) — ба сабки
 * product-card-и ItemFeedCard-и саҳифаи асосӣ мутобиқ карда шуд (акси
 * inset бо padding, соя-и мулоим, rounded калон, pill-и поёнӣ). Аз
 * ItemFeedCard фарқ мекунад: барои соҳиби эълон тугмаҳои edit/delete ва
 * overlay-и ҳолати moderation (pending/rejected) дорад.
 */
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Item, UNSPECIFIED_REWARD, ItemService } from "@/lib/services/item-service";
import {
  ArrowRight,
  Pencil,
  Trash2,
  Loader2,
  ShieldAlert,
  Clock,
  Share2,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ItemCard({ item }: { item: Item; index?: number; savedItemIds?: Set<string> }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { getToken, userId } = useAuth();

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isOwner = !!userId && userId === item.user_id;
  const exactDate = format(new Date(item.date), "dd.MM.yyyy");
  const thumb = item.images?.[0]?.image_url;

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/items/${item.id}/edit`);
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
      const token = await getToken({ template: "supabase" });
      if (!token) throw new Error("Not authenticated");
      const supabase = createClerkSupabaseClient(token);
      await ItemService.deleteItem(supabase, item.id);
      toast.success(t("success"));
      setShowDeleteConfirm(false);
      window.dispatchEvent(new Event("items-updated"));
    } catch {
      toast.error(t("error"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shareData = {
      title: item.title,
      text: item.description,
      url: `${window.location.origin}/items/${item.id}`,
    };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else if (typeof window !== "undefined" && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: "SHARE", payload: shareData }),
      );
    } else {
      navigator.clipboard.writeText(shareData.url);
      toast.success(t("success"));
    }
  };

  return (
    <>
      <Link
        href={`/items/${item.id}`}
        prefetch
        className="flex flex-col gap-2 rounded-3xl p-2 bg-white dark:bg-gradient-to-b dark:from-zinc-900 dark:to-emerald-800/70 shadow-[0_1px_2px_rgba(5,150,105,0.09),0_9px_20px_rgba(5,150,105,0.16),0_18px_36px_-14px_rgba(5,150,105,0.21)] dark:shadow-none dark:border dark:border-emerald-900/30 overflow-hidden"
      >
        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {thumb && (
            <Image
              src={thumb}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              quality={75}
              className={cn(
                "object-cover",
                item.moderation_status === "rejected" && isOwner && "opacity-75 grayscale-[0.5]",
              )}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />

          <span
            className={cn(
              "absolute top-2 left-2 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] min-[1084px]:text-xs min-[1920px]:text-sm font-black shadow-lg",
              item.type === "lost" ? "bg-red-600 text-white" : "bg-[#0eab7a] text-white",
            )}
          >
            {item.type === "lost" ? t("lost") : t("found")}
          </span>

          {item.similarity_score !== undefined && (
            <span className="absolute top-2 left-2 mt-8 inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-black shadow-md bg-emerald-600 text-white">
              {Math.round(item.similarity_score * 100)}% {t("matchForYourImage")}
            </span>
          )}

          {isOwner ? (
            <div className="absolute top-2 right-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleEdit}
                aria-label={t("edit")}
                className="w-7 h-7 min-[1084px]:w-8 min-[1084px]:h-8 min-[1920px]:w-9 min-[1920px]:h-9 flex items-center justify-center rounded-full bg-white text-zinc-700 shadow-lg hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 min-[1084px]:w-4 min-[1084px]:h-4 min-[1920px]:w-[18px] min-[1920px]:h-[18px]" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                aria-label={t("delete")}
                className="w-7 h-7 min-[1084px]:w-8 min-[1084px]:h-8 min-[1920px]:w-9 min-[1920px]:h-9 flex items-center justify-center rounded-full bg-white text-red-600 shadow-lg hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 min-[1084px]:w-4 min-[1084px]:h-4 min-[1920px]:w-[18px] min-[1920px]:h-[18px]" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleShare}
              aria-label={t("share")}
              className="absolute top-2 right-2 w-7 h-7 min-[1084px]:w-8 min-[1084px]:h-8 min-[1920px]:w-9 min-[1920px]:h-9 flex items-center justify-center rounded-full bg-white text-zinc-700 shadow-lg hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 min-[1084px]:w-4 min-[1084px]:h-4 min-[1920px]:w-[18px] min-[1920px]:h-[18px]" />
            </button>
          )}

          {isOwner && item.moderation_status === "pending" && (
            <div
              className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-10 cursor-pointer backdrop-blur-[2px]"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toast.info(t("imageModeration.pending"));
              }}
            >
              <div className="bg-white/95 dark:bg-zinc-900/95 p-4 rounded-2xl shadow-2xl flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center animate-pulse">
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
                <span className="text-[10px] font-black text-amber-600 tracking-wider block">
                  {t("imageModeration.pending")}
                </span>
              </div>
            </div>
          )}

          {isOwner && item.moderation_status === "rejected" && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-10 cursor-pointer backdrop-blur-[4px]">
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-2xl flex flex-col items-center text-center gap-3 border border-red-500/20">
                <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6 text-red-600" />
                </div>
                <span className="text-[10px] font-black text-red-600 tracking-wider block">
                  {t("imageModeration.rejected")}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="px-1 pb-1 flex flex-col flex-1 gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate font-extrabold text-[15px] min-[1084px]:text-base min-[1920px]:text-lg text-zinc-900 dark:text-zinc-100">
              {item.title || item.category}
            </h3>
            <span className="shrink-0 text-[11px] min-[1084px]:text-xs min-[1920px]:text-sm font-bold text-zinc-400 dark:text-zinc-500">
              {exactDate}
            </span>
          </div>

          {item.description && (
            <p className="text-[11px] min-[1084px]:text-xs min-[1920px]:text-sm text-zinc-400 dark:text-zinc-500 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}

          <span className="mt-auto translate-y-0.5 flex items-center justify-between gap-2 rounded-full pl-2.5 pr-1 py-1 min-[1084px]:py-1.5 bg-emerald-100 dark:bg-emerald-950/40 shadow-sm">
            <span className="min-w-0 flex items-center gap-1 text-[11px] min-[1084px]:text-xs min-[1920px]:text-sm font-black text-emerald-700 dark:text-emerald-400">
              {item.reward === UNSPECIFIED_REWARD ? (
                <span className="min-w-0 truncate">{t("reward_unspecified_viewer")}</span>
              ) : item.reward ? (
                <span className="min-w-0 truncate">{`${t("reward_gives_viewer")} ${item.reward} TJS`}</span>
              ) : (
                <span className="min-w-0 truncate">{t("moreInfoViewer")}</span>
              )}
            </span>
            <span className="shrink-0 w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 min-[1920px]:w-7 min-[1920px]:h-7 flex items-center justify-center rounded-full bg-emerald-600 dark:bg-emerald-500">
              <ArrowRight className="w-3 h-3 min-[1084px]:w-3.5 min-[1084px]:h-3.5 min-[1920px]:w-4 min-[1920px]:h-4 text-white" />
            </span>
          </span>
        </div>
      </Link>

      <Dialog
        open={showDeleteConfirm}
        onOpenChange={(open) => !isActionLoading && setShowDeleteConfirm(open)}
      >
        <DialogContent
          className="sm:max-w-md rounded-[1.75rem] p-6 gap-5 border-none shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="space-y-2.5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-1 bg-red-50 dark:bg-red-900/20 text-red-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-black tracking-tight leading-snug">
              {t("deleteConfirmTitle") || t("delete")}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 font-medium text-[13px] leading-relaxed">
              {t("deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:justify-start pt-2">
            <Button
              type="button"
              variant="destructive"
              className="flex-1 h-12 rounded-xl font-black tracking-widest text-[10px] text-white"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                confirmDelete();
              }}
              disabled={isActionLoading}
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("delete")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 rounded-xl font-black tracking-widest text-[10px] border-zinc-200"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeleteConfirm(false);
              }}
              disabled={isActionLoading}
            >
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
