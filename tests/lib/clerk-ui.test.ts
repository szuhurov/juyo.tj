import { describe, expect, it } from "vitest";
import { clerkNeedsUi } from "@/lib/clerk-ui";

describe("pages that load Clerk's UI bundle", () => {
  it("is on for the sign-in, sign-up and account settings screens", () => {
    for (const path of ["/sign-in", "/sign-in/factor-one", "/sign-up", "/sign-up/verify-email-address", "/profile/edit"]) {
      expect(clerkNeedsUi(path)).toBe(true);
    }
  });

  it("is off everywhere else", () => {
    for (const path of ["/", "/items/abc", "/profile", "/profile/my-posts", "/sign-inx", "/admin", null, undefined]) {
      expect(clerkNeedsUi(path)).toBe(false);
    }
  });
});
