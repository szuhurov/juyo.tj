/**
 * Ин тарҳи асосии сайт аст (Layout).
 * Дар ин ҷо Ҳедер, модал барои телефон ва Футер ҷойгир шудаанд.
 * Ҳамаи саҳифаҳои ин раздел дар дохили ин файл рендеринг мешаванд.
 */

import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { MobileNavbar } from "@/components/mobile-navbar";
import { HomeProvider } from "@/lib/home-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BlockedAccountScreen } from "@/components/blocked-account-screen";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (userId) {
    const { data: profile } = await supabaseAdmin.from("profiles").select("status").eq("id", userId).maybeSingle();
    if (profile?.status === "deleted") {
      return <BlockedAccountScreen />;
    }
  }

  return (
    <HomeProvider>
    <div className="flex flex-col min-h-screen bg-white">
      {/* Ҳедери сайт (Шапка) - Persistent UI */}
      <Header />

      {/* Ин ҷо мӯҳтавои асосии саҳифаҳо мебарояд (Main Content) */}
      <main className="flex-1 pt-12 sm:pt-16 pb-20 md:pb-0">
        {children}
      </main>

      {/* Поёни сайт (Footer) */}
      <footer data-nosnippet className="border-t py-8 bg-zinc-50 dark:bg-zinc-950 mt-12 mb-20 md:mb-0 hidden md:block">
        <div className="max-w-[1600px] mx-auto px-4 text-center text-zinc-500 text-sm">
          <p>© 2026 juyo - All rights reserved.</p>
          <div className="mt-2">
            <a href="/privacy" className="hover:underline">Сиёсати махфият</a>
          </div>
        </div>
      </footer>

      {/* Навбари мобилӣ (Bottom Navigation) - Persistent UI */}
      <MobileNavbar />
    </div>
    </HomeProvider>
  );
}
