"use client";

/**
 * Listing card for the profile (My Listings / Saved) — matches the
 * product-card style of the home page's ItemFeedCard (inset image with
 * padding, soft shadow, large rounded corners, bottom pill). Differs
 * from ItemFeedCard: has edit/delete buttons for the listing owner and
 * a moderation status overlay (pending/rejected).
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
  /** The moment publishing started (Date.now()) — if the user just
   *  published this listing. A countdown is shown over the image because
   *  the AI check on the server takes a few seconds.
   *
   *  Deliberately a TIMESTAMP, not a `boolean`: uploading images takes
   *  3-5 seconds and the card only appears afterward — with a boolean
   *  the countdown would restart from 10 right at that point, even
   *  though the check had already begun. */
  justPublishedAt?: number;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const { getToken, userId } = useAuth();

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // The URL may exist but the image may still fail to load — see ItemFeedCard.
  const [imgFailed, setImgFailed] = useState(false);
  // `tick` is only used to recompute the remaining time — the countdown
  // itself is derived from `justPublishedAt`, not from state, so it
  // doesn't restart if the card appears late.
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

  // After the countdown, if the listing was approved, a green indicator
  // stays for a few seconds — otherwise the user would see no result at
  // all, since an approved listing has no overlay.
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
      const supabase = createClerkSupabaseClient(getToken);
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
        className="group flex flex-col gap-0 rounded-xl bg-white dark:bg-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_5px_12px_-4px_rgba(15,23,42,0.07),0_12px_24px_-14px_rgba(15,23,42,0.09)] dark:shadow-none overflow-hidden"
      >
        {/* Image is rounded on all four sides — the type indicator moved
            to the bottom button, so a mask and `-mb-px` are no longer needed. */}
        <div className="relative aspect-[4/3] rounded-xl bg-zinc-100 dark:bg-zinc-700">
          {/* Placeholder is ALWAYS underneath — see ItemFeedCard: without
              this, its spot stays empty while the image is loading. */}
          <ImagePlaceholder className="rounded-xl" />
          {thumb && !imgFailed && (
            <Image
              src={thumb}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              quality={75}
              className={cn(
                "object-cover rounded-xl",
                item.moderation_status === "rejected" && isOwner && "opacity-75 grayscale-[0.5]",
              )}
              onError={() => setImgFailed(true)}
            />
          )}

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

          {/* Verification countdown — z-30, above everything else (the
              item type indicator is z-20, the moderation overlay is z-10). */}
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

        <div className="px-3.5 pt-1.5 pb-2 flex flex-col flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate font-bold text-sm min-[1084px]:text-base text-zinc-900 dark:text-white">
              {item.title || item.category}
            </h3>
            <span className="shrink-0 text-[11px] min-[1084px]:text-xs font-medium text-zinc-400 dark:text-zinc-500">
              {exactDate}
            </span>
          </div>

          {/* Description — one line, see ItemFeedCard (both cards look the same). */}
          {item.description && (
            <p className="mt-0.5 truncate text-[11px] min-[1084px]:text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {item.description}
            </p>
          )}

          {/* Item type and arrow as ONE button
              (see ItemFeedCard — both cards look the same). */}
          {/* See ItemFeedCard — same button: 4px wider, `-mb-[7px]` at the
              bottom, shadow around the arrow. */}
          <span className="mt-1 -mx-1 flex items-center justify-between gap-2 rounded-full bg-canvas p-0.5 pl-3">
            {/* Type color — see ItemFeedCard: 700 shades, so "Lost" and
                "Found" are distinguishable and readable at a glance. */}
            <span
              className={cn(
                "min-w-0 truncate text-xs min-[1084px]:text-[13px] font-bold",
                item.type === "lost"
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-emerald-700 dark:text-emerald-400",
              )}
            >
              {item.type === "lost" ? t("lost") : t("found")}
            </span>
            <span className="shrink-0 grid place-items-center size-7 min-[1084px]:size-8 rounded-full bg-emerald-500 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.55)] dark:shadow-none">
              <ArrowRight className="w-[17px] h-[17px] min-[1084px]:w-[19px] min-[1084px]:h-[19px] text-white" />
            </span>
          </span>
        </div>
      </Link>

      <Dialog
        open={showDeleteConfirm}
        onOpenChange={(open) => !isActionLoading && setShowDeleteConfirm(open)}
      >
        <DialogContent
          className="sm:max-w-md rounded-xl p-6 gap-5 border-none shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="space-y-2.5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-1 bg-red-50 dark:bg-red-900/20 text-red-600">
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
