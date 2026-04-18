/**
 * Ин тарҳи асосии сайт аст (Layout).
 * Дар ин ҷо Ҳедер, модал барои телефон ва Футер ҷойгир шудаанд.
 * Ҳамаи саҳифаҳои ин раздел дар дохили ин файл рендеринг мешаванд.
 */

import { Header } from "@/components/header";
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
      <main className="flex-1 pt-14 sm:pt-16">
        {children}
      </main>

      {/* Поёни сайт (Footer) */}
      <footer className="border-t py-8 bg-zinc-50 dark:bg-zinc-950 mt-12">
        <div className="container mx-auto px-4 text-center text-zinc-500 text-sm">
          <p>© {new Date().getFullYear()} JUYO.TJ - All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
