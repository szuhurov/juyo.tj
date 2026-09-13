"use client";

/**
 * Ҳедер (навбари боло) танҳо дар саҳифаи асосӣ намоён аст — талаби корбар:
 * дар дигар саҳифаҳо (профил, эълон, огоҳиномаҳо ва ғ.) ҷустуҷӯ/навигатсияи
 * такрории Header лозим нест, ҳар саҳифа навигатсияи худашро дорад.
 *
 * `<main>` низ ҳамин ҷо идора мешавад: padding-top-и болоӣ танҳо барои
 * ҷои Header лозим буд — дар дигар саҳифаҳо бе Header он падингро нигоҳ
 * доштан як фазои холии бемаънӣ мемонд (талаби корбар: "чизҳое, ки дар
 * тагаш буданд, боло баред, чун болои онҳо холист").
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";

export function HomeOnlyHeader() {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return <Header />;
}

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  return (
    <main className={cn("flex-1 pb-20 md:pb-0", isHome && "pt-12 sm:pt-16")}>
      {children}
    </main>
  );
}

/**
 * Пеш аз ин "Сиёсати махфият" сахт (hardcoded) ба тоҷикӣ навишта шуда
 * буд — дар ru/en низ ҳамон матни тоҷикӣ намоён мешуд. Талаби корбар:
 * тарҷумаи дуруст, пас ин ба client component кӯчид, то `t()` кор кунад.
 */
export function SiteFooter() {
  const { t } = useLanguage();
  return (
    <footer data-nosnippet className="border-t py-8 bg-zinc-50 dark:bg-zinc-950 mt-12 mb-20 md:mb-0 hidden md:block">
      <div className="w-full px-4 text-center text-zinc-500 text-sm">
        <p>© 2026 juyo - All rights reserved.</p>
        <div className="mt-2">
          <Link href="/privacy" className="hover:underline">{t("privacyPolicy")}</Link>
        </div>
      </div>
    </footer>
  );
}
