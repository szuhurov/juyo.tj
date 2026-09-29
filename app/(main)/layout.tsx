/**
 * This is the site's main layout (Layout).
 * The Header, the phone modal, and the Footer live here.
 * All pages in this section render inside this file.
 */

import { auth } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";
import { HomeOnlyHeader, MainContent, SiteFooter } from "@/components/home-only-header";
import { MobileNavbar } from "@/components/mobile-navbar";
import { HomeProvider } from "@/lib/home-context";
import { AddLauncherProvider } from "@/components/add-photo-launcher";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BlockedAccountScreen } from "@/components/blocked-account-screen";
import { syncProfileFromClerk } from "@/lib/services/profile-sync";

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
      .select("status, phone, email, first_name")
      .eq("id", userId)
      .maybeSingle();
    return data;
  },
  ["main-layout-profile-status-v2"],
  { revalidate: 30 },
);

// Clerk → profile fill (email/name/phone) at most once an hour per user, so a
// profile that stays incomplete (e.g. no phone in Clerk) doesn't hit the Clerk
// API on every navigation.
const syncProfileHourly = unstable_cache(
  async (userId: string) => {
    await syncProfileFromClerk(userId);
    return true;
  },
  ["main-layout-profile-sync"],
  { revalidate: 3600 },
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

    // Fallback for the clerk-sync webhook: create the profile if it is missing
    // and fill any EMPTY email/name/phone from Clerk (never overwrites).
    if (!profile || !profile.email || !profile.first_name || !profile.phone) {
      try {
        await syncProfileHourly(userId);
      } catch (err) {
        console.error("profile sync from Clerk failed:", err instanceof Error ? err.message : "unknown");
      }
    }
  }

  return (
    <HomeProvider>
    <AddLauncherProvider>
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
    </AddLauncherProvider>
    </HomeProvider>
  );
}
