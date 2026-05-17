"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { Home, QrCode, PlusCircle, ScanLine, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function MobileNavbar() {
  const pathname = usePathname();
  const router = useRouter();
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
      const isProtected =
        href.includes("/profile") || href.includes("/items/add");

      if (isProtected && !userId) {
        router.push("/sign-up");
      } else {
        const target = href === "/profile" ? "/profile?tab=posts" : href;
        
        // Гузариши лаҳзавӣ
        router.push(target);
        
        // Дар замина (background) саҳифаро пешакӣ бор мекунем
        router.prefetch(target);

        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: "instant" });
        }
      }
    } catch (err) {
      console.error("Navigation error:", err);
      // Fallback: Агар router кор накунад, истифодаи window.location
      window.location.href = href;
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[5000] bg-white border-t border-zinc-100 dark:bg-zinc-950 dark:border-zinc-900 md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.1)] pointer-events-auto">
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map((item) => {
          let isActive = pathname === item.href;
          if (item.id === "qr") {
            isActive =
              pathname === "/profile" && searchParams.get("tab") === "qr";
          } else if (item.id === "profile") {
            isActive =
              pathname === "/profile" &&
              (!searchParams.get("tab") || searchParams.get("tab") !== "qr");
          }

          if (item.isProfile) {
            return (
              <button
                key={item.href}
                onClick={(e) => handleNavClick(item.href, e)}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[64px] h-full gap-1 transition-all",
                  isActive ? "text-zinc-900 dark:text-white" : "text-zinc-400",
                )}
              >
                <div
                  className={cn(
                    "p-0.5 rounded-full border-2 transition-all",
                    isActive
                      ? "border-zinc-900 dark:border-white"
                      : "border-transparent",
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
              className={cn(
                "flex flex-col items-center justify-center min-w-[50px] h-full gap-1 transition-all active:scale-90",
                isActive ? "text-zinc-900 dark:text-white" : "text-zinc-400",
              )}
            >
              <item.icon
                className={cn("h-6 w-6", isActive && "stroke-[2.5px]")}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
