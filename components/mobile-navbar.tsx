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

  // Reset optimistic path when real pathname changes
  useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  const { user } = useUser();
  const { userId } = useAuth();
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  const navItems = [
    {
      label: t("home"),
      href: "/",
      icon: Home,
    },
    {
      id: "qr",
      label: "QR",
      href: "/profile?tab=qr",
      icon: QrCode,
    },
    {
      label: t("addItemTitle"),
      href: "/items/add",
      icon: PlusCircle,
      isMain: true,
    },
    {
      label: "Scan",
      href: "/scan",
      icon: ScanLine,
    },
    {
      id: "profile",
      label: t("profile"),
      href: "/profile",
      icon: User,
      isProfile: true,
    },
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
          if (pathname === "/") {
            router.refresh();
            return;
          }
          triggerGoHome();
        }

        setOptimisticPath(href);
        router.push(target);
        
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: "instant" });
        }
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
    const target = href === "/profile" ? "/profile?tab=posts" : href;
    router.prefetch(target);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[5000] bg-white border-t border-zinc-100 dark:bg-zinc-950 dark:border-zinc-900 md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.1)] pointer-events-auto">
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map((item) => {
          const currentPath = optimisticPath || pathname;
          let isActive = currentPath === item.href;

          // Маддиқи махсус барои табҳо дар профил
          if (item.id === "qr") {
            if (optimisticPath) {
              isActive = optimisticPath === "/profile?tab=qr";
            } else {
              isActive = pathname === "/profile" && searchParams.get("tab") === "qr";
            }
          } else if (item.id === "profile") {
            if (optimisticPath) {
              isActive = optimisticPath === "/profile";
            } else {
              isActive = pathname === "/profile" && (!searchParams.get("tab") || searchParams.get("tab") !== "qr");
            }
          }

          if (item.isProfile) {
            return (
              <button
                key={item.href}
                onClick={(e) => handleNavClick(item.href, e)}
                onMouseEnter={() => handlePrefetch(item.href)}
                onTouchStart={() => handlePrefetch(item.href)}
                className="flex items-center justify-center min-w-[64px] h-full"
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full transition-all duration-150",
                    isActive 
                      ? "bg-zinc-900 dark:bg-zinc-100 border-2 border-zinc-900 dark:border-white" 
                      : "border-2 border-transparent"
                  )}
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user?.imageUrl} />
                    <AvatarFallback className="text-[10px] bg-zinc-100 dark:bg-zinc-800">
                      {user?.firstName?.charAt(0) || (
                        <User className="h-5 w-5" />
                      )}
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
              className="flex items-center justify-center min-w-[50px] h-full"
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 active:scale-90",
                  isActive 
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" 
                    : "text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                )}
              >
                <item.icon
                  className={cn("h-6 w-6", isActive && "stroke-[2.5px]")}
                />
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
