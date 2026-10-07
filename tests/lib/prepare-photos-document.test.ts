import { beforeEach, describe, expect, it, vi } from "vitest";

// The detectors run in a browser; here only the decision around them is tested.
const embedPhoto = vi.fn();
const protectPhoto = vi.fn();
vi.mock("@/lib/visual-search", () => ({ embedPhoto: (f: File) => embedPhoto(f) }));
vi.mock("@/lib/photo-privacy", () => ({
  protectPhoto: (f: File, c: string | null) => protectPhoto(f, c),
  finalizePhoto: vi.fn(),
}));
vi.mock("@/lib/document-head", () => ({
  looksLikeDocument: (_model: string, v: number[]) => v[0] === 1,
}));

const { preparePhotos } = await import("@/lib/prepare-photos");
const file = (name: string) => new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
const neverOpen = vi.fn(async () => null);

beforeEach(() => {
  embedPhoto.mockReset();
  protectPhoto.mockReset();
  protectPhoto.mockImplementation(async (f: File) => ({ status: "safe", file: f, assessment: { reasons: [], regions: [], documentLike: false } }));
});

describe("preparePhotos: document and card photos outside Documents/Cards", () => {
  it("refuses the whole set before any processing when one photo looks like a document", async () => {
    embedPhoto.mockImplementation(async (f: File) => ({ model: "m", vector: [f.name === "card.jpg" ? 1 : 0] }));
    const out = await preparePhotos([file("bag.jpg"), file("card.jpg")], "Wallet", neverOpen);
    expect(out.status).toBe("document_photo");
    expect(protectPhoto).not.toHaveBeenCalled();
  });

  it("lets ordinary photos through", async () => {
    embedPhoto.mockResolvedValue({ model: "m", vector: [0] });
    const out = await preparePhotos([file("bag.jpg")], "Wallet", neverOpen);
    expect(out.status).toBe("ready");
  });

  it("falls back to the OCR pipeline when the model is unavailable", async () => {
    embedPhoto.mockRejectedValue(new Error("model failed"));
    const out = await preparePhotos([file("bag.jpg")], "Wallet", neverOpen);
    expect(out.status).toBe("ready");
    expect(protectPhoto).toHaveBeenCalled();
  });

  it("does not run the check in Documents/Cards (those photos are never uploaded)", async () => {
    embedPhoto.mockResolvedValue({ model: "m", vector: [1] });
    await preparePhotos([file("id.jpg")], "Documents", neverOpen);
    expect(embedPhoto).not.toHaveBeenCalled();
  });
});
