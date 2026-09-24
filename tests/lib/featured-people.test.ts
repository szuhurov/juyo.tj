import { describe, it, expect } from "vitest";
import { toFeaturedItems, excludeFeatured, isDefaultFeed } from "@/lib/featured-people";
import type { Item } from "@/lib/services/item-service";

function make(id: string, over: Partial<Item> = {}): Item {
  return {
    id,
    type: "lost",
    title: `t${id}`,
    description: "d",
    images: [{ image_url: `https://x/${id}.jpg` }],
    ...over,
  } as unknown as Item;
}

describe("toFeaturedItems", () => {
  it("returns nothing when no item is VIP/VVIP", () => {
    expect(toFeaturedItems([make("1"), make("2", { vip_tier: "none" })])).toEqual([]);
    expect(toFeaturedItems([])).toEqual([]);
  });

  it("keeps every vip and vvip (with or without a photo), preserves order and carries the tier", () => {
    const out = toFeaturedItems([
      make("1", { vip_tier: "vvip", type: "found" }),
      make("2", { vip_tier: "vvip" }),
      make("3", { vip_tier: "vip", images: [] }),
      make("4", { vip_tier: "vip" }),
    ]);
    expect(out.map((i) => [i.id, i.vipTier, i.type])).toEqual([
      ["1", "vvip", "found"],
      ["2", "vvip", "lost"],
      ["3", "vip", "lost"],
      ["4", "vip", "lost"],
    ]);
    expect(out[2].coverUrl).toBeNull();
  });

  it("shows up to 50 paid listings", () => {
    const many = Array.from({ length: 60 }, (_, i) => make(String(i), { vip_tier: "vip" }));
    expect(toFeaturedItems(many)).toHaveLength(50);
  });
});

describe("excludeFeatured", () => {
  it("removes exactly the items shown in the strip and keeps order", () => {
    const items = [make("1"), make("2"), make("3"), make("4")];
    const featured = toFeaturedItems([make("2", { vip_tier: "vip" }), make("4", { vip_tier: "vvip" })]);
    expect(excludeFeatured(items, featured).map((i) => i.id)).toEqual(["1", "3"]);
  });

  it("moves a VIP item without a photo into the strip too", () => {
    const vip = [make("1", { vip_tier: "vip", images: [] }), make("2", { vip_tier: "vip" })];
    const items = [make("1"), make("2"), make("3")];
    expect(excludeFeatured(items, toFeaturedItems(vip)).map((i) => i.id)).toEqual(["3"]);
  });

  it("excludes nothing when there are no VIP items", () => {
    const items = [make("1"), make("2")];
    expect(excludeFeatured(items, toFeaturedItems([]))).toBe(items);
  });
});

describe("isDefaultFeed", () => {
  it("is true with no search and no filters ('All' category counts as none)", () => {
    expect(isDefaultFeed({})).toBe(true);
    expect(isDefaultFeed({ search: "", category: "All", type: null })).toBe(true);
    expect(isDefaultFeed({ search: "   " })).toBe(true);
  });

  it.each([
    { search: "keys" },
    { category: "Keys" },
    { type: "found" },
    { type: "lost" },
    { dateFrom: "2026-01-01" },
    { dateTo: "2026-01-31" },
    { locationType: "taxi" },
    { city: "dushanbe" },
  ])("is false when %o is active", (f) => {
    expect(isDefaultFeed(f)).toBe(false);
  });
});
