import { describe, expect, it } from "vitest";
import { canKeepFound, canPostFound } from "@/lib/found-policy";

describe("who may post a Found listing", () => {
  it("lets everyone post found keys, and verified accounts any category", () => {
    expect(canPostFound("Keys", false)).toBe(true);
    expect(canPostFound("Phone", false)).toBe(false);
    expect(canPostFound("Documents", false)).toBe(false);
    expect(canPostFound(null, false)).toBe(false);
    expect(canPostFound("Phone", true)).toBe(true);
  });

  it("keeps an existing Found listing on edit only in its own category", () => {
    const old = { type: "found", category: "Wallet" };
    expect(canKeepFound("Wallet", false, old)).toBe(true);
    expect(canKeepFound("Phone", false, old)).toBe(false);
    expect(canKeepFound("Keys", false, old)).toBe(true);
    expect(canKeepFound("Wallet", false, { type: "lost", category: "Wallet" })).toBe(false);
  });
});
