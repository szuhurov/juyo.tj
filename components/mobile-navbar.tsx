"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { useHomeState } from "@/lib/home-context";
import { useAddLauncher } from "@/components/add-photo-launcher";
import { Home, QrCode, PlusCircle, ScanLine, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Same as the app's BottomNav: a wide capsule (56×40) in emerald at 16% behind
// the active tab, the icon itself green — not a solid green square.
const ACTIVE_PILL = "absolute w-14 h-10 rounded-full bg-emerald-500/15";
const ACTIVE_ICON = "text-emerald-600 dark:text-emerald-400";
const IDLE_ICON = "text-slate-400 dark:text-zinc-400";

export function MobileNavbar() {
  const pathname = usePathname();
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const router = useRouter();
  const { triggerGoHome } = useHomeState();
  const { openAddLauncher } = useAddLauncher();

  useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  const { user } = useUser();
  const { userId } = useAuth();
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  // The "+" button is shown to everyone, like in the app; a logged-out tap
  // goes to sign-up (handleNavClick).
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
      const isProtected = href.includes("/profile") || href === "/items/add";
      if (isProtected && !userId) {
        router.push("/sign-up");
      } else {
        // Like the app: "+" opens the photo sheet over this page first.
        if (href === "/items/add") { openAddLauncher(); return; }
        const target = href === "/profile" ? "/profile?tab=posts" : href;
        if (href === "/") {
          if (pathname === "/") { triggerGoHome(); return; }
          triggerGoHome();
        }
        setOptimisticPath(href);
        router.push(target);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
      }
    } catch (err) {
      console.error("Navigation error:", err);
      // Fallback: if router.push throws for whatever reason, do a full
      // page navigation — this is the only reliable way to let the user
      // continue; it's not an on-render mutation (only in an event handler).
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

  // The scan page is a full-screen camera with its own back button — no navbar there.
  if (pathname === "/scan" || pathname?.startsWith("/scan/")) return null;

  return (
    // The bar is anchored to the bottom edge (Alif style): full width, no
    // rounding, just a separator line on top. The safe-area is applied to
    // the bar ITSELF, so the content doesn't touch the home indicator on iPhone.
    <nav
      data-nosnippet
      // Floating, rounded (Telegram-style): gaps from the sides and from the
      // bottom/home indicator; content scrolls under it.
      className="fixed left-3 right-3 bottom-[calc(env(safe-area-inset-bottom)+8px)] z-[45] md:hidden material rounded-[28px] border border-hairline dark:border-white/10 shadow-[0_6px_24px_-6px_rgba(0,0,0,0.25)] overflow-hidden"
    >
      <div>
        <div className="flex items-center justify-around h-[60px] px-1.5">
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
                  className="relative flex items-center justify-center"
                >
                  {isActive && <span aria-hidden className={ACTIVE_PILL} />}
                  <div className={cn("relative w-10 h-10 flex items-center justify-center", isActive ? ACTIVE_ICON : IDLE_ICON)}>
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
                  className="relative flex items-center justify-center"
                >
                  {isActive && <span aria-hidden className={ACTIVE_PILL} />}
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user?.imageUrl} />
                      <AvatarFallback className={cn(
                        "text-[10px]",
                        isActive ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-zinc-700"
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
                className="relative flex items-center justify-center"
              >
                {isActive && <span aria-hidden className={ACTIVE_PILL} />}
                <div className={cn("relative w-10 h-10 flex items-center justify-center", isActive ? ACTIVE_ICON : IDLE_ICON)}>
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
