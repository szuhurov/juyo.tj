"use client";

/**
 * "Important People" — a curated VIP-style discovery row on the Feed. This
 * component is the presentation layer only: it takes `items`/`isLoading` as
 * props and renders nothing when there's nothing to show.
 *
 * Layout is pure CSS: a snap-scrolling strip whose cards are a bounded
 * fraction of the row (one card + a peek on phones, 2/3/4 cards on wider
 * screens — see FEATURED_CARD_SIZE), so cards never grow with the viewport.
 */
import { useLanguage } from "@/lib/language-context";
import { FeaturedPersonCard } from "@/components/featured-person-card";
import {
  FeaturedPeopleSkeleton,
  FEATURED_CARD_SIZE,
  FEATURED_SINGLE_CARD_SIZE,
} from "@/components/featured-people-skeleton";
import type { FeaturedItem } from "@/lib/featured-people";

export function FeaturedPeopleCarousel({
  items,
  isLoading,
}: {
  items: FeaturedItem[];
  isLoading?: boolean;
}) {
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="mb-2.5">
        <FeaturedPeopleSkeleton />
      </div>
    );
  }

  // Intentional: no fake people, no "coming soon" placeholder — the
  // section simply isn't there until real featured data exists.
  if (!items.length) return null;

  const single = items.length === 1;

  return (
    <div className="mb-2.5">
      <div
        role="region"
        aria-label={t("importantPeopleTitle")}
        tabIndex={0}
        className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory no-scrollbar py-1 -my-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-2 rounded-md"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={`snap-start shrink-0 ${single ? FEATURED_SINGLE_CARD_SIZE : FEATURED_CARD_SIZE}`}
          >
            <FeaturedPersonCard item={item} single={single} />
          </div>
        ))}
      </div>
    </div>
  );
}
