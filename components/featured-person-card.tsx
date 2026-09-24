"use client";

/**
 * Card for the home "Important" carousel — a listing's cover photo with a
 * dark scrim, then:
 *   top row     TYPE (Lost / Found) · VIP tag (top-right)
 *   bottom      TITLE (item name), then [ description (ONE line) | › ]
 * The whole card links to the item's page.
 */
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { useLanguage } from "@/lib/language-context";
import {
  FEATURED_CARD_ASPECT,
  FEATURED_SINGLE_CARD_ASPECT,
} from "@/components/featured-people-skeleton";
import { cn } from "@/lib/utils";
import type { FeaturedItem } from "@/lib/featured-people";

export function FeaturedPersonCard({ item, single }: { item: FeaturedItem; single?: boolean }) {
  const { t } = useLanguage();
  const [coverFailed, setCoverFailed] = useState(false);
  const typeLabel = t(item.type);

  return (
    <Link
      href={`/items/${item.id}`}
      aria-label={`${typeLabel} — ${item.title}`}
      className={cn(
        "relative block w-full rounded-md overflow-hidden bg-zinc-800 shadow-[var(--shadow-1)] dark:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-2",
        single ? FEATURED_SINGLE_CARD_ASPECT : FEATURED_CARD_ASPECT,
      )}
    >
      <ImagePlaceholder className="rounded-md" />
      {!coverFailed && (
        <Image
          src={item.coverUrl}
          alt=""
          fill
          sizes={single ? "(max-width: 1280px) 100vw, 1240px" : "(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"}
          className="object-cover"
          onError={() => setCoverFailed(true)}
        />
      )}

      {/* Scrim: only under the text (bottom), fully transparent by ~58% of the height; the photo above stays untinted. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/15 via-30% to-transparent to-58%" />

      <div className="absolute inset-0 px-2.5 pt-2.5 pb-2 flex flex-col justify-end">
        {/* Both chips sit flush in the top corners of the card (the card's own rounded corner clips them). */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2">
          {/* Type chip: solid red (lost) / green (found) with white text, like the Lost / Found filter pills. */}
          <span
            className={cn(
              "min-w-0 truncate rounded-br-xl px-2 py-1 text-[13px] font-semibold leading-none text-white",
              item.type === "lost" ? "bg-rose-500" : "bg-emerald-500",
            )}
          >
            {typeLabel}
          </span>
          {(item.vipTier === "vip" || item.vipTier === "vvip") && (
            <span
              className={cn(
                "shrink-0 rounded-bl-xl px-2 py-1 text-xs font-semibold uppercase leading-none tracking-wider",
                item.vipTier === "vvip" ? "bg-amber-500 text-white" : "bg-yellow-400 text-zinc-900",
              )}
            >
              {item.vipTier === "vvip" ? "VVIP" : "VIP"}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-0 min-w-0">
          <span className="text-base font-semibold leading-tight text-white truncate [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">{item.title}</span>
          <div className="flex items-center gap-3 min-w-0">
            <p className="flex-1 min-w-0 truncate text-xs font-medium leading-tight text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">{item.description}</p>
            <ArrowRight aria-hidden className="shrink-0 -my-1 w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    </Link>
  );
}
