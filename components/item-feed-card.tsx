"use client";

/**
 * Item card for the home page feed (2 per row, not a list). Differs from
 * ItemCard/ItemListRow: type+share on top of the image, title+reward on
 * one line, description, and at the end date + "enter" icon. Style is
 * product-card (inset image with padding, soft shadow, large rounded corners).
 */
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Crown } from "lucide-react";
import { format } from "date-fns";
import { CATEGORY_IMAGES, type Item } from "@/lib/services/item-service";
import { useLanguage } from "@/lib/language-context";
import { ImagePlaceholder, ImageSkeleton } from "@/components/image-placeholder";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PAID_FEATURES_ENABLED } from "@/lib/feature-flags";
import { splitOwnerLine } from "@/lib/document-owner";

export function ItemFeedCard({ item }: { item: Item }) {
  const { t } = useLanguage();
  // Small copy for cards (lib/listing-photo-upload.ts); older listings fall back to the full photo.
  const thumb = item.images?.[0]?.thumbnail_url || item.images?.[0]?.image_url;
  // "I don't have a photo" listings (items/add) have no item_images row at
  // all — the category illustration stands in so the card isn't blank.
  const categoryFallback = CATEGORY_IMAGES[item.category];
  const exactDate = format(new Date(item.date), "dd.MM.yyyy");
  // Checking just `thumb` isn't enough: the URL may exist but the image
  // may still fail to load (404, deleted file). onError catches this
  // case and shows the placeholder instead.
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const showThumb = !!thumb && !imgFailed;
  const src = showThumb ? thumb : categoryFallback;

  return (
    <Link
      href={`/items/${item.id}`}
      // No viewport prefetch: every visible card would request /items/<id> and
      // use up the per-IP contact-route limit in middleware.ts (429).
      prefetch={false}
      className="pressable group flex flex-col gap-0 rounded-md bg-white dark:bg-transparent overflow-hidden"
    >
      {/* Image is rounded on all four sides — the type indicator moved
          from here to the bottom button, so the mask's inner corner and
          `-mb-px` are no longer needed. */}
      <div className="relative aspect-[16/10] rounded-md bg-slate-100 dark:bg-zinc-700">
        {/* The skeleton stays until the photo has actually loaded; the icon is
            only for a listing that has nothing to show at all. */}
        {!src ? (
          <ImagePlaceholder className="rounded-md" />
        ) : (
          !imgLoaded && <ImageSkeleton className="rounded-md" />
        )}
        {src && (
          <Image
            key={src}
            src={src}
            alt={showThumb ? item.title : item.category}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover rounded-md"
            onLoad={() => setImgLoaded(true)}
            onError={() => (showThumb ? setImgFailed(true) : setImgLoaded(true))}
          />
        )}
        {PAID_FEATURES_ENABLED && (item.vip_tier === "vip" || item.vip_tier === "vvip") && (
          <span
            className={cn(
              "absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-white shadow-sm",
              item.vip_tier === "vvip" ? "bg-gradient-to-r from-amber-500 to-amber-600" : "bg-zinc-700",
            )}
          >
            <Crown className="w-3 h-3" />
            {item.vip_tier === "vvip" ? "VIP" : "TOP"}
          </span>
        )}
      </div>

      {/* User request: the card's bottom section (under the image) should
          shrink by ~10-15%, but title/date should stay untouched — so only
          padding/margin was reduced, not text size. */}
      <div className="pr-3 pt-1 pb-1 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate font-semibold text-sm min-[1084px]:text-base text-zinc-900 dark:text-white">
            {item.title || item.category}
          </h3>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {exactDate}
          </span>
        </div>

        {/* Description — ONE line, gray and smaller than the title, so the
            hierarchy isn't broken. `truncate` is mandatory: the card's
            height in the grid must stay consistent regardless of text
            length. */}
        {item.description && (
          <p className="-mt-0.5 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {splitOwnerLine(item.description).rest}
          </p>
        )}

        {/* Below the description — item type and arrow as ONE button.
            It's a `span`, not a `button`: the whole card is already an
            `<a>`, and a button nested inside a link produces invalid HTML. */}
        {/* User request: no background/pill here anymore — it was
            pushing the type text further in than title/description
            above it. Now it's a plain row, flush with the same left/right
            edges as the rest of the card content (no -mx-1/padding/bg). */}
        <span className="mt-0.5 mb-0.5 flex items-center justify-between gap-2">
          {/* Type color — saturated, not muted: "Lost" and "Found" must be
              distinguishable at a glance. 700 shades pass WCAG AA contrast
              against the `--canvas` background (500/600 don't).
              Size — user request: smaller than the title, larger than the
              description (title text-sm/base, description text-xs). */}
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
          <span className="shrink-0 grid place-items-center size-6 min-[1084px]:size-7 rounded-full bg-primary text-primary-foreground">
            <ArrowRight className="w-[15px] h-[15px] min-[1084px]:w-[17px] min-[1084px]:h-[17px]" />
          </span>
        </span>
      </div>
    </Link>
  );
}
