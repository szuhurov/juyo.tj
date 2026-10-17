import { describe, expect, it } from "vitest";
import { isNoPhotoCategory, isPlaceholderUrl, placeholderImageUrl } from "@/lib/photo-policy";

describe("photo policy: Documents and Cards never get a photo", () => {
  it("knows the no-photo categories", () => {
    expect(isNoPhotoCategory("Documents")).toBe(true);
    expect(isNoPhotoCategory("Cards")).toBe(true);
    for (const c of ["Wallet", "Electronics", "Keys", "Other", "", null, undefined]) expect(isNoPhotoCategory(c)).toBe(false);
  });

  it("points each category at its JUYO image", () => {
    expect(placeholderImageUrl("Cards")).toBe("https://juyo.tj/placeholders/card.png");
    expect(placeholderImageUrl("Documents")).toBe("https://juyo.tj/placeholders/document.png");
    expect(isPlaceholderUrl(placeholderImageUrl("Cards"))).toBe(true);
    expect(isPlaceholderUrl("https://aztuszloghjkynukjkaa.supabase.co/storage/v1/object/public/items/a.jpg")).toBe(false);
    expect(isPlaceholderUrl(null)).toBe(false);
  });
});


describe("licence plates (owner decision 2026-10-17)", () => {
  it("never upload a photo and show the JUYO plate image", async () => {
    const { isNoPhotoCategory, placeholderImageUrl, hasOwnerField } = await import("@/lib/photo-policy");
    expect(isNoPhotoCategory("LicensePlate")).toBe(true);
    expect(placeholderImageUrl("LicensePlate")).toBe("https://juyo.tj/placeholders/plate.png");
    expect(hasOwnerField("LicensePlate")).toBe(false);
    expect(hasOwnerField("Documents")).toBe(true);
  });
});
