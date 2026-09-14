/**
 * This is the site's main layout (Layout).
 * The Header, the phone modal, and the Footer live here.
 * All pages in this section render inside this file.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";
import { HomeOnlyHeader, MainContent, SiteFooter } from "@/components/home-only-header";
import { MobileNavbar } from "@/components/mobile-navbar";
import { HomeProvider } from "@/lib/home-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BlockedAccountScreen } from "@/components/blocked-account-screen";

// This read (status/phone) in this layout used to run on EVERY navigation
// (even within this same group, e.g. home → profile) — one DB request per
// click, which contributed to slow transitions. The cache (30 seconds)
// doesn't eliminate that slowness, but the "blocked account" gate and the
// phone backfill still take effect within a few seconds — not truly
// "instant", but that's enough for a background check.
const getCachedProfileStatus = unstable_cache(
  async (userId: string) => {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("status, phone")
      .eq("id", userId)
      .maybeSingle();
    return data;
  },
  ["main-layout-profile-status"],
  { revalidate: 30 },
);

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (userId) {
    const profile = await getCachedProfileStatus(userId);
    if (profile?.status === "deleted") {
      return <BlockedAccountScreen />;
    }

    // Fallback for when the clerk-sync webhook fails (e.g. a mismatched
    // signing secret) — so the profile never ends up "missing", and the
    // phone number from Clerk (e.g. when signing up with a phone number)
    // isn't left without it. For a profile that already exists, only an
    // EMPTY phone field gets filled — we don't re-fetch name/surname/email
    // from Clerk, because the user may have updated them inside the app
    // itself while Clerk (due to that same webhook issue) is still stale.
    if (!profile) {
      const clerkUser = await currentUser();
      if (clerkUser) {
        const primaryEmail = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
        const primaryPhone = clerkUser.phoneNumbers.find((p) => p.id === clerkUser.primaryPhoneNumberId);
        await supabaseAdmin.from("profiles").upsert({
          id: userId,
          first_name: clerkUser.firstName || "",
          last_name: clerkUser.lastName || "",
          avatar_url: clerkUser.imageUrl || "",
          phone: primaryPhone?.phoneNumber || clerkUser.phoneNumbers[0]?.phoneNumber || null,
          email: primaryEmail?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || null,
          updated_at: new Date().toISOString(),
        });
      }
    } else if (!profile.phone) {
      const clerkUser = await currentUser();
      const primaryPhone = clerkUser?.phoneNumbers.find((p) => p.id === clerkUser.primaryPhoneNumberId);
      const phone = primaryPhone?.phoneNumber || clerkUser?.phoneNumbers[0]?.phoneNumber;
      if (phone) {
        await supabaseAdmin.from("profiles").update({ phone, updated_at: new Date().toISOString() }).eq("id", userId);
      }
    }
  }

  return (
    <HomeProvider>
    <div className="flex flex-col min-h-screen bg-canvas">
      {/* Site header (Header) - only on the home page (user request: other
          pages don't need duplicate search/navigation). */}
      <HomeOnlyHeader />

      {/* This is where the pages' main content renders (Main Content) */}
      <MainContent>{children}</MainContent>

      {/* Site bottom (Footer) */}
      <SiteFooter />

      {/* Mobile navbar (Bottom Navigation) - Persistent UI */}
      <MobileNavbar />
    </div>
    </HomeProvider>
  );
}
