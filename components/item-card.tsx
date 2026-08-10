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
import { Item, ItemService } from "@/lib/services/item-service";
import {
  ArrowRight,
  Pencil,
  Trash2,
  Loader2,
  ShieldAlert,
  Clock,
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

  return (
    <>
      <Link
        href={`/items/${item.id}`}
        prefetch
        className="flex flex-col gap-0 rounded-3xl bg-white dark:bg-gradient-to-b dark:from-zinc-900 dark:to-emerald-800/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_5px_12px_-4px_rgba(15,23,42,0.07),0_12px_24px_-14px_rgba(15,23,42,0.09)] dark:shadow-none overflow-hidden"
      >
        <div className="relative aspect-[4/3] -mb-px rounded-t-3xl bg-zinc-100 dark:bg-zinc-800">
          {thumb && (
            <Image
              src={thumb}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              quality={75}
              className={cn(
                "object-cover rounded-t-3xl",
                item.moderation_status === "rejected" && isOwner && "opacity-75 grayscale-[0.5]",
              )}
            />
          )}

          <span
            className={cn(
              "absolute -bottom-1.5 right-0 inline-flex items-end leading-none rounded-none rounded-tl-lg px-3 pt-1.5 pb-0 text-xs min-[1084px]:text-sm font-bold bg-white dark:bg-zinc-900",
              item.type === "lost"
                ? "text-rose-700 dark:text-rose-400"
                : "text-green-700 dark:text-green-400",
            )}
          >
            {/* Кунҷи БОТИНӢ (concave) дар чапи badge — ниг. ItemFeedCard */}
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0 right-[calc(100%-1px)] h-6 w-6 bg-white dark:bg-zinc-900"
              style={{
                WebkitMaskImage:
                  "radial-gradient(circle at 0 0, transparent 23px, black 25px)",
                maskImage:
                  "radial-gradient(circle at 0 0, transparent 23px, black 25px)",
              }}
            />
            {item.type === "lost" ? t("lost") : t("found")}
          </span>

          {item.similarity_score !== undefined && (
            <span className="absolute top-2 left-2 mt-8 inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-bold bg-emerald-600 text-white">
              {Math.round(item.similarity_score * 100)}% {t("matchForYourImage")}
            </span>
          )}

          {isOwner && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleEdit}
                aria-label={t("edit")}
                className="w-7 h-7 min-[1084px]:w-8 min-[1084px]:h-8 min-[1920px]:w-9 min-[1920px]:h-9 flex items-center justify-center rounded-full bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 min-[1084px]:w-4 min-[1084px]:h-4 min-[1920px]:w-[18px] min-[1920px]:h-[18px]" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                aria-label={t("delete")}
                className="w-7 h-7 min-[1084px]:w-8 min-[1084px]:h-8 min-[1920px]:w-9 min-[1920px]:h-9 flex items-center justify-center rounded-full bg-white border border-zinc-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 min-[1084px]:w-4 min-[1084px]:h-4 min-[1920px]:w-[18px] min-[1920px]:h-[18px]" />
              </button>
            </div>
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
                <span className="text-[10px] font-bold text-amber-600 tracking-wider block">
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
                <span className="text-[10px] font-bold text-red-600 tracking-wider block">
                  {t("imageModeration.rejected")}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="px-3.5 pt-2 pb-3.5 flex flex-col flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate font-bold text-sm min-[1084px]:text-base text-zinc-900 dark:text-zinc-100">
              {item.title || item.category}
            </h3>
            <span className="shrink-0 text-[11px] min-[1084px]:text-xs font-medium text-zinc-400 dark:text-zinc-500">
              {exactDate}
            </span>
          </div>

          {item.description && (
            <div className="relative mt-auto">
              <p className="text-[11px] min-[1084px]:text-xs text-zinc-400 dark:text-zinc-500 line-clamp-2 leading-snug pr-8">
                {item.description}
              </p>
              <span className="absolute bottom-0 right-0 w-7 h-7 min-[1084px]:w-8 min-[1084px]:h-8 flex items-center justify-center rounded-full bg-emerald-500">
                <ArrowRight className="w-4 h-4 min-[1084px]:w-[18px] min-[1084px]:h-[18px] text-white" />
              </span>
            </div>
          )}
        </div>
      </Link>

      <Dialog
        open={showDeleteConfirm}
        onOpenChange={(open) => !isActionLoading && setShowDeleteConfirm(open)}
      >
        <DialogContent
          className="sm:max-w-md rounded-2xl p-6 gap-5 border-none shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="space-y-2.5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-1 bg-red-50 dark:bg-red-900/20 text-red-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold tracking-tight leading-snug">
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
              className="flex-1 h-12 rounded-xl font-bold tracking-widest text-[10px] text-white"
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
              className="flex-1 h-12 rounded-xl font-bold tracking-widest text-[10px] border-zinc-200"
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
