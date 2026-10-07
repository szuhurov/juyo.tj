import { describe, expect, it } from "vitest";
import { isNoPhotoCategory, isPlaceholderUrl, placeholderImageUrl } from "@/lib/photo-policy";
import { DOCUMENT_HEAD_MODEL, DOCUMENT_HEAD_THRESHOLD, documentScore, looksLikeDocument } from "@/lib/document-head";
import { VISUAL_MODEL } from "@/lib/visual-model";

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

describe("document head", () => {
  it("scores only vectors of the visual-search model", () => {
    expect(DOCUMENT_HEAD_MODEL).toBe(VISUAL_MODEL.id);
    const v = new Array(VISUAL_MODEL.dim).fill(0);
    expect(documentScore("another-model", v)).toBeNull();
    expect(documentScore(DOCUMENT_HEAD_MODEL, v.slice(1))).toBeNull();
    expect(looksLikeDocument("another-model", v)).toBe(false);
  });

  it("returns a probability and applies the threshold", () => {
    const v = Array.from({ length: VISUAL_MODEL.dim }, (_, i) => Math.sin(i) / Math.sqrt(VISUAL_MODEL.dim));
    const s = documentScore(DOCUMENT_HEAD_MODEL, v)!;
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
    expect(looksLikeDocument(DOCUMENT_HEAD_MODEL, v)).toBe(s >= DOCUMENT_HEAD_THRESHOLD);
  });
});
