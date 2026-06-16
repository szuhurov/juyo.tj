"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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

  const navItems = [
    { label: t("home"), href: "/", icon: Home },
    { id: "qr", label: "QR", href: "/profile?tab=qr", icon: QrCode },
    { label: t("addItemTitle"), href: "/items/add", icon: PlusCircle, isMain: true },
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
    <nav
      className="fixed bottom-0 left-0 right-0 z-[5000] md:hidden pointer-events-none"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-3 pointer-events-auto">
        <div className="flex items-center justify-around h-[60px] bg-white dark:bg-zinc-900 rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.06)] border border-zinc-100 dark:border-zinc-800 px-2">
          {navItems.map((item) => {
            const currentPath = optimisticPath || pathname;
            let isActive = currentPath === item.href;
            const isNavigatingTo = optimisticPath === item.href && optimisticPath !== pathname;

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
                  className="flex items-center justify-center"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 transition-transform duration-150 text-zinc-400">
                    <item.icon className="h-6 w-6" />
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
                  className="flex items-center justify-center active:scale-90 transition-transform duration-150"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150",
                    isActive ? "bg-zinc-900 dark:bg-zinc-100" : "",
                    isNavigatingTo && "animate-pulse"
                  )}>
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user?.imageUrl} />
                      <AvatarFallback className={cn(
                        "text-[10px]",
                        isActive ? "bg-zinc-700 text-white" : "bg-zinc-100 dark:bg-zinc-800"
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
                className="flex items-center justify-center active:scale-90 transition-transform duration-150"
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150",
                  isActive
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "text-zinc-400 dark:text-zinc-500",
                  isNavigatingTo && "animate-pulse"
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
