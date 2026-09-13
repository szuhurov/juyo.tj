"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { useHomeState } from "@/lib/home-context";
import { Home, QrCode, PlusCircle, ScanLine, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function MobileNavbar() {
  const pathname = usePathname();
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const router = useRouter();
  const { triggerGoHome } = useHomeState();

  useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  const { user } = useUser();
  const { userId } = useAuth();
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  // Тугмаи "+" (эълони нав) танҳо барои корбари воридшуда — `/items/add`
  // аллакай тавассути middleware муҳофизат мешавад, вале нишон додани он
  // ба корбари бе login бесамар аст (пахш → бозгашт ба sign-in).
  const navItems = [
    { label: t("home"), href: "/", icon: Home },
    { id: "qr", label: "QR", href: "/profile?tab=qr", icon: QrCode },
    ...(userId
      ? [{ label: t("addItemTitle"), href: "/items/add", icon: PlusCircle, isMain: true }]
      : []),
    { label: "Scan", href: "/scan", icon: ScanLine },
    { id: "profile", label: t("profile"), href: "/profile", icon: User, isProfile: true },
  ];

  const handleNavClick = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const isProtected = href.includes("/profile");
      if (isProtected && !userId) {
        router.push("/sign-up");
      } else {
        const target = href === "/profile" ? "/profile?tab=posts" : href;
        if (href === "/") {
          if (pathname === "/") { router.refresh(); return; }
          triggerGoHome();
        }
        setOptimisticPath(href);
        router.push(target);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
      }
    } catch (err) {
      console.error("Navigation error:", err);
      // Fallback: агар router.push бо ягон сабаб партояд, гузариши пурраи
      // саҳифа (full page navigation) — ин ягона роҳи боэътимоди идомаи
      // корбар аст, on-render mutation нест (танҳо дар event handler).
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = href;
    }
  };

  const prefetchedSet = new Set<string>();
  const handlePrefetch = (href: string) => {
    if (prefetchedSet.has(href)) return;
    prefetchedSet.add(href);
    router.prefetch(href === "/profile" ? "/profile?tab=posts" : href);
  };

  return (
    // Навор ба лаби поён мечаспад (сабки Alif): паҳнои пурра, бе мудаввар,
    // танҳо як хати ҷудокунанда дар боло. safe-area ба ХУДИ навор дода
    // мешавад, то дар iPhone мӯҳтаво ба хати home ламс накунад.
    <nav
      data-nosnippet
      className="fixed bottom-0 left-0 right-0 z-[5000] md:hidden bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-800"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div>
        <div className="flex items-center justify-around h-[60px] px-2">
          {navItems.map((item) => {
            const currentPath = optimisticPath || pathname;
            let isActive = currentPath === item.href;

            if (item.id === "qr") {
              isActive = optimisticPath
                ? optimisticPath === "/profile?tab=qr"
                : pathname === "/profile" && searchParams.get("tab") === "qr";
            } else if (item.id === "profile") {
              isActive = optimisticPath
                ? optimisticPath === "/profile"
                : pathname === "/profile" && (!searchParams.get("tab") || searchParams.get("tab") !== "qr");
            }

            if (item.isMain) {
              return (
                <button
                  key={item.href}
                  onClick={(e) => handleNavClick(item.href, e)}
                  onMouseEnter={() => handlePrefetch(item.href)}
                  onTouchStart={() => handlePrefetch(item.href)}
                  aria-label={item.label}
                  className="flex items-center justify-center"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    isActive ? "bg-emerald-500 text-white" : "text-zinc-400 dark:text-zinc-500"
                  )}>
                    <item.icon className={cn("h-6 w-6", isActive && "stroke-[2.5px]")} />
                  </div>
                </button>
              );
            }

            if (item.isProfile) {
              return (
                <button
                  key={item.href}
                  onClick={(e) => handleNavClick(item.href, e)}
                  onMouseEnter={() => handlePrefetch(item.href)}
                  onTouchStart={() => handlePrefetch(item.href)}
                  aria-label={item.label}
                  className="flex items-center justify-center"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    isActive ? "bg-emerald-500" : ""
                  )}>
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user?.imageUrl} />
                      <AvatarFallback className={cn(
                        "text-[10px]",
                        isActive ? "bg-emerald-600 text-white" : "bg-zinc-100 dark:bg-zinc-700"
                      )}>
                        {user?.firstName?.charAt(0) || <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </button>
              );
            }

            return (
              <button
                key={item.href}
                onClick={(e) => handleNavClick(item.href, e)}
                onMouseEnter={() => handlePrefetch(item.href)}
                onTouchStart={() => handlePrefetch(item.href)}
                aria-label={item.label}
                className="flex items-center justify-center"
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isActive
                    ? "bg-emerald-500 text-white"
                    : "text-zinc-400 dark:text-zinc-500"
                )}>
                  <item.icon className={cn("h-6 w-6", isActive && "stroke-[2.5px]")} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
