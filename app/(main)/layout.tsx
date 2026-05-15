/**
 * Ин тарҳи асосии сайт аст (Layout).
 * Дар ин ҷо Ҳедер, модал барои телефон ва Футер ҷойгир шудаанд.
 * Ҳамаи саҳифаҳои ин раздел дар дохили ин файл рендеринг мешаванд.
 */

import { Header } from "@/components/header";
import { MobileNavbar } from "@/components/mobile-navbar";
import { MandatoryPhoneModal } from "@/components/mandatory-phone-modal";
import { Suspense } from "react";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Ҳедери сайт (Шапка) */}
      <Suspense fallback={<div className="h-16 border-b bg-white animate-pulse" />}>
        <Header />
      </Suspense>

      {/* Модали ҳатмӣ барои гирифтани рақами телефони корбар */}
      <MandatoryPhoneModal />

      {/* Ин ҷо мӯҳтавои асосии саҳифаҳо мебарояд (Main Content) */}
      <main className="flex-1 pt-12 sm:pt-16 pb-20 md:pb-0">
        {children}
      </main>

      {/* Поёни сайт (Footer) - Ҳамеша дар паси Navbar-и мобилӣ мемонад ё дар мобил пинҳон мешавад */}
      <footer className="border-t py-8 bg-zinc-50 dark:bg-zinc-950 mt-12 mb-20 md:mb-0 hidden md:block">
        <div className="max-w-[1600px] mx-auto px-4 text-center text-zinc-500 text-sm">
          <p>© 2026 juyo - All rights reserved.</p>
        </div>
      </footer>

      {/* Навбари мобилӣ (Bottom Navigation) */}
      <Suspense fallback={<div className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t md:hidden" />}>
        <MobileNavbar />
      </Suspense>
    </div>
  );
}
