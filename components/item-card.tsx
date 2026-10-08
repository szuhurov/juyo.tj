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
import { CATEGORY_IMAGES, Item, ItemService } from "@/lib/services/item-service";
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
import { ImagePlaceholder } from "@/components/image-placeholder";
import { splitOwnerLine } from "@/lib/document-owner";

export function ItemCard({
  item,
}: {
  item: Item;
  index?: number;
  savedItemIds?: Set<string>;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const { getToken, userId } = useAuth();

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // The URL may exist but the image may still fail to load — see ItemFeedCard.
  const [imgFailed, setImgFailed] = useState(false);
  const isOwner = !!userId && userId === item.user_id;
  const exactDate = format(new Date(item.date), "dd.MM.yyyy");
  const thumb = item.images?.[0]?.image_url;
  // "I don't have a photo" listings have no item_images row — fall back to
  // the category illustration (see ItemFeedCard).
  const categoryFallback = CATEGORY_IMAGES[item.category];

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
        className="pressable group flex flex-col gap-0 rounded-md bg-white dark:bg-zinc-800 overflow-hidden"
      >
        {/* Image is rounded on all four sides — the type indicator moved
            to the bottom button, so a mask and `-mb-px` are no longer needed. */}
        <div className="relative aspect-[4/3] rounded-md bg-slate-100 dark:bg-zinc-700">
          {/* Placeholder is ALWAYS underneath — see ItemFeedCard: without
              this, its spot stays empty while the image is loading. */}
          <ImagePlaceholder className="rounded-md" />
          {thumb && !imgFailed && (
            <Image
              src={thumb}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              quality={75}
              className={cn(
                "object-cover rounded-md",
                item.moderation_status === "rejected" && isOwner && "opacity-75 grayscale-[0.5]",
              )}
              onError={() => setImgFailed(true)}
            />
          )}
          {(!thumb || imgFailed) && categoryFallback && (
            <Image
              src={categoryFallback}
              alt={item.category}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              quality={75}
              className="object-cover rounded-md"
            />
          )}

          {isOwner && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleEdit}
                aria-label={t("edit")}
                className="size-9 flex items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-hairline dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                aria-label={t("delete")}
                className="size-9 flex items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-hairline dark:border-zinc-700 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              >
                <Trash2 className="size-4" />
              </button>
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
              <div className="bg-white/95 dark:bg-zinc-800/95 px-3 py-2.5 rounded-md flex flex-col items-center text-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center animate-pulse">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 leading-tight block">
                  {t("imageModeration.pending")}
                </span>
              </div>
            </div>
          )}

          {isOwner && item.moderation_status === "rejected" && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-2 z-10 cursor-pointer backdrop-blur-[4px]">
              <div className="bg-white dark:bg-zinc-800 px-3 py-2.5 rounded-md flex flex-col items-center text-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                </div>
                <span className="text-xs font-semibold text-destructive dark:text-red-400 leading-tight block">
                  {t("imageModeration.rejected")}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="px-3.5 pt-1.5 pb-2 flex flex-col flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate font-semibold text-sm min-[1084px]:text-base text-zinc-900 dark:text-white">
              {item.title || item.category}
            </h3>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {exactDate}
            </span>
          </div>

          {/* Description — one line, see ItemFeedCard (both cards look the same). */}
          {item.description && (
            <p className="mt-0.5 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {splitOwnerLine(item.description).rest}
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
                "min-w-0 truncate text-[13px] font-medium",
                item.type === "lost"
                  ? "text-lost"
                  : "text-found",
              )}
            >
              {item.type === "lost" ? t("lost") : t("found")}
            </span>
            <span className="shrink-0 grid place-items-center size-7 min-[1084px]:size-8 rounded-full bg-primary text-primary-foreground">
              <ArrowRight className="w-[17px] h-[17px] min-[1084px]:w-[19px] min-[1084px]:h-[19px]" />
            </span>
          </span>
        </div>
      </Link>

      <Dialog
        open={showDeleteConfirm}
        onOpenChange={(open) => !isActionLoading && setShowDeleteConfirm(open)}
      >
        <DialogContent
          className="sm:max-w-md rounded-[var(--radius-card)] p-6 gap-5 border-none shadow-[var(--shadow-3)]"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="space-y-2.5">
            <div className="w-11 h-11 rounded-md flex items-center justify-center mb-1 bg-red-50 dark:bg-red-900/20 text-red-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg tracking-tight leading-snug">
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
              className="flex-1 h-12 rounded-[var(--radius-control)] text-sm"
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
              className="flex-1 h-12 rounded-[var(--radius-control)] text-sm border-slate-200 dark:border-zinc-700"
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
