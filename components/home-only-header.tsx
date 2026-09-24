"use client";

/**
 * The header (top bar) used to be shown ONLY on the home page — other pages
 * relied on their own local navigation instead (e.g. profile's own sidebar).
 * Now that the profile page's sidebar is gone (its tabs moved into the
 * Header's own nav — see components/header.tsx), a page with no Header has
 * NO navigation at all. So the Header now renders everywhere (user request).
 *
 * `<main>` is also managed here: the top padding-top matches the Header's
 * height, and now applies on every page since the Header always renders.
 */
import Link from "next/link";
import { Header } from "@/components/header";
import { useLanguage } from "@/lib/language-context";

export function HomeOnlyHeader() {
  return <Header />;
}

export function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 pb-20 md:pb-0 pt-12 sm:pt-16">
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
    <footer data-nosnippet className="border-t py-8 bg-slate-50 dark:bg-zinc-950 mt-12 mb-20 md:mb-0 hidden md:block">
      <div className="w-full px-4 text-center text-slate-500 text-sm">
        <p>© 2026 juyo - All rights reserved.</p>
        <div className="mt-2">
          <Link href="/privacy" className="hover:underline">{t("privacyPolicy")}</Link>
        </div>
      </div>
    </footer>
  );
}
