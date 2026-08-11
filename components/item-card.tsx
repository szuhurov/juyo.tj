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
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useEffect, useState } from "react";
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
import { ImagePlaceholder } from "@/components/image-placeholder";
import { PUBLISH_COUNTDOWN_SECONDS } from "@/lib/ui-constants";

const APPROVED_FLASH_MS = 4000;

export function ItemCard({
  item,
  justPublishedAt,
}: {
  item: Item;
  index?: number;
  savedItemIds?: Set<string>;
  /** Лаҳзаи оғози нашр (Date.now()) — агар эълонро корбар ҳозир нашр
   *  карда бошад. Дар болои акс ҳисобкунак нишон дода мешавад, чунки
   *  санҷиши AI дар сервер якчанд сония мегирад.
   *
   *  Маҳз ЛАҲЗА, на `boolean`: боркунии аксҳо 3-5 сония мегирад ва корт
   *  баъд аз он пайдо мешавад — бо boolean ҳисобкунак маҳз ҳамон вақт аз
   *  нав аз 10 сар мешуд, дар ҳоле ки санҷиш аллакай оғоз шудааст. */
  justPublishedAt?: number;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const { getToken, userId } = useAuth();

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // URL метавонад мавҷуд бошад, вале акс бор нашавад — ниг. ItemFeedCard.
  const [imgFailed, setImgFailed] = useState(false);
  // `tick` танҳо барои аз нав ҳисоб кардани вақти боқимонда — худи
  // ҳисобкунак аз `justPublishedAt` бармеояд, на аз state, то он ҳангоми
  // дертар пайдо шудани корт аз нав сар нашавад.
  const [tick, setTick] = useState(0);
  const [flashDone, setFlashDone] = useState(false);

  const countdown = justPublishedAt
    ? Math.max(
        0,
        PUBLISH_COUNTDOWN_SECONDS -
          Math.floor((Date.now() - justPublishedAt) / 1000),
      )
    : 0;

  useEffect(() => {
    if (!justPublishedAt || countdown <= 0) return;
    const id = setTimeout(() => setTick((v) => v + 1), 1000);
    return () => clearTimeout(id);
  }, [justPublishedAt, countdown, tick]);

  // Баъд аз ҳисобкунак, агар эълон тасдиқ шуда бошад, чанд сония нишонаи
  // сабз мемонад — вагарна корбар ҳеҷ натиҷаро намедид, зеро эълони
  // тасдиқшуда ягон overlay надорад.
  useEffect(() => {
    if (!justPublishedAt || countdown > 0 || flashDone) return;
    const id = setTimeout(() => setFlashDone(true), APPROVED_FLASH_MS);
    return () => clearTimeout(id);
  }, [justPublishedAt, countdown, flashDone]);

  const isOwner = !!userId && userId === item.user_id;
  const checkingNow = countdown > 0;
  const approvedFlash =
    !!justPublishedAt &&
    countdown === 0 &&
    !flashDone &&
    item.moderation_status === "approved";
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
        className="flex flex-col gap-0 rounded-3xl bg-white dark:bg-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_5px_12px_-4px_rgba(15,23,42,0.07),0_12px_24px_-14px_rgba(15,23,42,0.09)] dark:shadow-none overflow-hidden"
      >
        <div className="relative aspect-[4/3] -mb-px rounded-t-3xl bg-zinc-100 dark:bg-zinc-700">
          {/* Placeholder ҲАМЕША дар таг — ниг. ItemFeedCard: бе ин дар
              лаҳзаи боршавии акс ҷои он холӣ мемонад. */}
          <ImagePlaceholder className="rounded-t-3xl" />
          {thumb && !imgFailed && (
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
              onError={() => setImgFailed(true)}
            />
          )}

          <span
            className={cn(
              "absolute -bottom-1.5 right-0 z-20 inline-flex items-end leading-none rounded-none rounded-tl-lg px-3 pt-1.5 pb-0 text-xs min-[1084px]:text-sm font-bold bg-white dark:bg-zinc-800",
              item.type === "lost"
                ? "text-rose-700 dark:text-rose-400"
                : "text-green-700 dark:text-green-400",
            )}
          >
            {/* Кунҷи БОТИНӢ (concave) дар чапи badge — ниг. ItemFeedCard */}
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0 right-[calc(100%-1px)] h-6 w-6 bg-white dark:bg-zinc-800"
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
                className="w-7 h-7 min-[1084px]:w-8 min-[1084px]:h-8 min-[1920px]:w-9 min-[1920px]:h-9 flex items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 min-[1084px]:w-4 min-[1084px]:h-4 min-[1920px]:w-[18px] min-[1920px]:h-[18px]" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                aria-label={t("delete")}
                className="w-7 h-7 min-[1084px]:w-8 min-[1084px]:h-8 min-[1920px]:w-9 min-[1920px]:h-9 flex items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 min-[1084px]:w-4 min-[1084px]:h-4 min-[1920px]:w-[18px] min-[1920px]:h-[18px]" />
              </button>
            </div>
          )}

          {/* Ҳисобкунаки санҷиш — z-30, аз ҳама болотар (нишони навъи
              ашё z-20 аст, overlay-и moderation z-10). */}
          {checkingNow && (
            <div className="absolute inset-0 z-30 bg-black/65 backdrop-blur-[2px] flex items-center justify-center">
              <div className="relative w-14 h-14">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    strokeWidth="3"
                    className="stroke-white/25"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="stroke-emerald-400 transition-[stroke-dashoffset] duration-1000 ease-linear"
                    strokeDasharray={2 * Math.PI * 16}
                    strokeDashoffset={
                      2 * Math.PI * 16 * (1 - countdown / PUBLISH_COUNTDOWN_SECONDS)
                    }
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg tabular-nums">
                  {countdown}
                </span>
              </div>
            </div>
          )}

          {approvedFlash && (
            <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-2">
              <div className="bg-white/95 dark:bg-zinc-800/95 px-3 py-2.5 rounded-xl flex flex-col items-center text-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 leading-tight block">
                  {t("postApproved")}
                </span>
              </div>
            </div>
          )}

          {isOwner && item.moderation_status === "pending" && (
            <div
              className="absolute inset-0 bg-black/60 flex items-center justify-center p-2 z-10 cursor-pointer backdrop-blur-[2px]"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toast.info(t("imageModeration.pending"));
              }}
            >
              <div className="bg-white/95 dark:bg-zinc-800/95 px-3 py-2.5 rounded-xl flex flex-col items-center text-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center animate-pulse">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <span className="text-[10px] font-bold text-amber-600 leading-tight block">
                  {t("imageModeration.pending")}
                </span>
              </div>
            </div>
          )}

          {isOwner && item.moderation_status === "rejected" && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-2 z-10 cursor-pointer backdrop-blur-[4px]">
              <div className="bg-white dark:bg-zinc-800 px-3 py-2.5 rounded-xl flex flex-col items-center text-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                </div>
                <span className="text-[10px] font-bold text-red-600 leading-tight block">
                  {t("imageModeration.rejected")}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="px-3.5 pt-2 pb-3.5 flex flex-col flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate font-bold text-sm min-[1084px]:text-base text-zinc-900 dark:text-white">
              {item.title || item.category}
            </h3>
            <span className="shrink-0 text-[11px] min-[1084px]:text-xs font-medium text-zinc-400 dark:text-zinc-400">
              {exactDate}
            </span>
          </div>

          {item.description && (
            <div className="relative mt-auto min-h-7 min-[1084px]:min-h-8">
              <p className="text-[11px] min-[1084px]:text-xs text-zinc-400 dark:text-zinc-400 line-clamp-2 leading-snug pr-8">
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
