/**
 * Ин тарҳи асосии сайт аст (Layout).
 * Дар ин ҷо Ҳедер, модал барои телефон ва Футер ҷойгир шудаанд.
 * Ҳамаи саҳифаҳои ин раздел дар дохили ин файл рендеринг мешаванд.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { Header } from "@/components/header";
import { MobileNavbar } from "@/components/mobile-navbar";
import { HomeProvider } from "@/lib/home-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BlockedAccountScreen } from "@/components/blocked-account-screen";
import { isAdminUser } from "@/lib/admin-auth";

// Ин хониш (status/phone) дар ин layout ДАР ҲАР ГУЗАРИШ (ҳатто дохили
// ҳамин гурӯҳ, масалан хона → профил) иҷро мешуд — як дархости DB барои
// ҳар клик, ки ба сустии гузариш мусоидат мекард. Кэш (30 сония) ин
// сустиро нест мекунад, вале боз ҳам блоки "ҳисоби басташуда" ва
// backfill-и телефон дар доираи чанд сония амал мекунанд — на воқеан
// "лаҳзавӣ", вале ин барои санҷиши заминавӣ кофист.
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
  const isAdmin = isAdminUser(userId);
  if (userId) {
    const profile = await getCachedProfileStatus(userId);
    if (profile?.status === "deleted") {
      return <BlockedAccountScreen />;
    }

    // Fallback барои вақте webhook-и clerk-sync ноком мешавад (масалан
    // signing secret номувофиқ) — то профил ҳаргиз "гум" нашавад ва телефони
    // аз Clerk (масалан ҳангоми сабти ном бо рақами телефон) бе он намонад.
    // Барои профили аллакай мавҷуда танҳо телефони ХОЛӢ пур мешавад — ном/
    // насаб/email-ро дубора аз Clerk намегирем, чунки шояд корбар онҳоро дар
    // худи барнома нав карда бошад ва Clerk (аз сабаби ҳамон webhook) ҳанӯз
    // куҳна бошад.
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
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950">
      {/* Ҳедери сайт (Шапка) - Persistent UI */}
      <Header isAdmin={isAdmin} />

      {/* Ин ҷо мӯҳтавои асосии саҳифаҳо мебарояд (Main Content) */}
      <main className="flex-1 pt-12 sm:pt-16 pb-20 md:pb-0">
        {children}
      </main>

      {/* Поёни сайт (Footer) */}
      <footer data-nosnippet className="border-t py-8 bg-zinc-50 dark:bg-zinc-950 mt-12 mb-20 md:mb-0 hidden md:block">
        <div className="w-full px-4 text-center text-zinc-500 text-sm">
          <p>© 2026 juyo - All rights reserved.</p>
          <div className="mt-2">
            <Link href="/privacy" className="hover:underline">Сиёсати махфият</Link>
          </div>
        </div>
      </footer>

      {/* Навбари мобилӣ (Bottom Navigation) - Persistent UI */}
      <MobileNavbar />
    </div>
    </HomeProvider>
  );
}
