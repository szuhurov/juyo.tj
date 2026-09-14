"use client";

/**
 * The header (top bar) is only shown on the home page — user request:
 * other pages (profile, listing, notifications, etc.) don't need the
 * repeated Header search/navigation, each page has its own navigation.
 *
 * `<main>` is also managed here: the top padding-top was only needed for
 * the Header's space — on other pages, without the Header, keeping that
 * padding left a pointless empty gap (user request: "move things that
 * were below it up, since there's nothing above them anymore").
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
 * Previously "Privacy Policy" was hardcoded in Tajik — the same Tajik
 * text also showed up in ru/en. User request: a proper translation, so
 * this was moved into a client component so `t()` would work.
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
