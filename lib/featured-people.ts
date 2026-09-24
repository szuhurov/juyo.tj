import type { Item } from "@/lib/services/item-service";

/**
 * Shape of one card in the home "Important" carousel: a VIP/VVIP listing
 * taken from the feed data that is already loaded — no extra query and no
 * separate backend concept. Kept in this file so
 * FeaturedPeopleCarousel/FeaturedPersonCard stay presentation-only.
 */
export interface FeaturedItem {
  id: string;
  type: "lost" | "found";
  /** Item name, shown as the card's TITLE. */
  title: string;
  /** Shown on ONE line under the title. */
  description: string;
  coverUrl: string;
  /** Drives the card's VIP / VVIP tag; no tag is rendered for "none"/undefined. */
  vipTier?: "none" | "vip" | "vvip";
}

export const MAX_FEATURED_ITEMS = 20;

/**
 * Strip cards from the `get_vip_items` RPC result. The RPC order (VVIP first,
 * then newest) is preserved; only listings with a photo are shown in the
 * strip, the rest simply stay in the ordinary list.
 */
export function toFeaturedItems(vipItems: Item[]): FeaturedItem[] {
  return vipItems
    .filter(
      (i) =>
        (i.vip_tier === "vip" || i.vip_tier === "vvip") &&
        i.title &&
        i.images?.[0]?.image_url,
    )
    .slice(0, MAX_FEATURED_ITEMS)
    .map((i) => ({
      id: i.id,
      type: i.type,
      title: i.title,
      description: i.description ?? "",
      coverUrl: i.images![0].image_url,
      vipTier: i.vip_tier,
    }));
}

/** Removes the listings shown in the strip from the ordinary list. */
export function excludeFeatured(items: Item[], featured: FeaturedItem[]): Item[] {
  if (!featured.length) return items;
  const ids = new Set(featured.map((f) => f.id));
  return items.filter((i) => !ids.has(i.id));
}

/**
 * The strip is shown (and its items removed from the ordinary list) only when
 * no search text and no filter is active.
 */
export function isDefaultFeed(f: {
  search?: string | null;
  category?: string | null;
  type?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  locationType?: string | null;
  city?: string | null;
}): boolean {
  return (
    !f.search?.trim() &&
    (!f.category || f.category === "All") &&
    !f.type &&
    !f.dateFrom &&
    !f.dateTo &&
    !f.locationType &&
    !f.city
  );
}
