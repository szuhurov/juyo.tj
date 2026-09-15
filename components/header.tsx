"use client";

/**
 * Main header section of the app (Header).
 * This component includes navigation, search, language switching, and the user menu.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import {
  Home,
  User,
  QrCode,
  PlusCircle,
  Settings,
  LayoutGrid,
  Bookmark,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { useHomeState } from "@/lib/home-context";
import { NotificationBell } from "@/components/notification-bell";
import { VerifiedBadge } from "@/components/verified-badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { userId } = useAuth();
  const { user } = useUser();

  // For the "verified" badge next to the user's own name — public_profiles
  // is visible to everyone, so no token is needed.
  const { data: ownProfile } = useQuery({
    queryKey: ["own-profile-verified", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("public_profiles")
        .select("is_verified")
        .eq("id", userId!)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const { t } = useLanguage();
  const { triggerGoHome } = useHomeState();

  const [mounted, setMounted] = useState(false);

  // Nav links — the middle "search" slot that used to live here moved to
  // the home page's filter bar (user request); these 4 profile tabs now
  // fill that space as top-level buttons instead of being tucked inside a
  // sidebar-only tab list on the profile page itself (see app/(main)/profile/page.tsx).
  const navLinks = [
    { href: "/", value: "home", tab: null, label: t("home"), icon: Home },
    { href: "/profile?tab=posts", value: "posts", tab: "posts", label: t("myPosts"), icon: LayoutGrid },
    { href: "/profile?tab=qr", value: "qr", tab: "qr", label: t("qrMyCode"), icon: QrCode },
    { href: "/profile?tab=saved", value: "saved", tab: "saved", label: t("savedItems"), icon: Bookmark },
  ];

  // Prevents a Hydration Mismatch — syncing "client is ready" the only
  // way possible: an effect (this is a native browser API, not render-derived state).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <TooltipProvider>
      <header
        data-nosnippet
        className="fixed top-0 left-0 right-0 z-50 w-full bg-canvas"
      >
        <div className="w-full max-w-7xl mx-auto flex h-12 sm:h-16 items-center px-2.5 sm:px-4 gap-2 sm:gap-4">
          {/* Left section: Logo only — nav moved to its own centered slot
              below (user request) now that the search box that used to sit
              there is gone. */}
          <div className="hidden sm:flex items-center flex-initial sm:flex-1">
            <Link
              href="/"
              aria-label="JUYO"
              className="flex items-center space-x-2 shrink-0"
              onClick={(e) => {
                if (pathname === "/") {
                  e.preventDefault();
                  router.refresh();
                } else {
                  triggerGoHome();
                }
              }}
            >
              <span className="hidden sm:inline text-2xl font-bold tracking-[-0.1em] text-zinc-900 dark:text-zinc-100">
                JUYO
              </span>
            </Link>
          </div>

          {/* Middle section: Main navigation, centered — this used to be the
              search bar's slot; search moved to the home page's filter bar. */}
          <div className="flex-[2] sm:flex-[1.5] max-w-xl flex items-center justify-center">
            <nav className="hidden lg:flex items-center space-x-1 bg-white dark:bg-zinc-800/50 p-1 rounded-lg">
              {/* `mounted` used to be used here too, to prevent a hydration
                  mismatch (based on the localStorage/cookie locale), but
                  that caused "icons appearing late" — a user complaint.
                  `pathname`/`t()` on the client's first render are identical
                  to SSR (the `juyo-locale` cookie is always updated together
                  with localStorage — see lib/language-context.tsx), so the
                  real risk of a mismatch is very low — not worth forcing a
                  delay on every user. */}
              {navLinks.map((link) => {
                  const currentTab = searchParams.get("tab") || "posts";
                  const isActive =
                    link.tab === null
                      ? pathname === link.href
                      : pathname === "/profile" && currentTab === link.tab;

                  // Function for manual handling
                  const handleNavClick = () => {
                    const isProtected =
                      link.href.includes("/profile") ||
                      link.href.includes("/items/add");

                    if (link.href === "/") {
                      if (pathname === "/") {
                        router.refresh();
                        return;
                      }
                      triggerGoHome();
                    }

                    if (isProtected && !userId) {
                      router.push("/sign-up");
                    } else {
                      router.push(link.href);
                    }
                  };

                  return (
                    <Button
                      key={link.href}
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      onClick={handleNavClick}
                      className={`gap-2 rounded-lg font-bold text-[13px] min-[1503px]:text-sm tracking-wider transition-all border ${
                        isActive
                          ? "bg-white text-zinc-900 border-emerald-500 ring-2 ring-emerald-500/20 dark:bg-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 border-transparent focus:outline-none"
                      }`}
                    >
                      <link.icon className="h-4 w-4 min-[1503px]:h-[18px] min-[1503px]:w-[18px]" />
                      {link.label}
                    </Button>
                  );
                })}
            </nav>
          </div>

          {/* Right section: Authentication. Language switching now happens from
              Profile → Personal info, not from here — see app/(main)/profile/page.tsx */}
          <div className="flex items-center gap-1.5 flex-initial sm:flex-1 justify-end shrink-0">
            {mounted && userId && <NotificationBell />}

            {/* User Button / Login (Desktop only) */}
            <div className="hidden sm:flex items-center space-x-2">
              {!userId ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100 h-10 px-3 border-none rounded-lg bg-white dark:bg-zinc-800 hover:bg-zinc-100"
                    asChild
                  >
                    <Link href="/sign-in">{t("login")}</Link>
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-lg font-bold text-[13px] bg-emerald-500 text-white hover:bg-emerald-600 h-10 px-4"
                    asChild
                  >
                    <Link href="/sign-up">{t("signup")}</Link>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        className="rounded-lg font-bold text-[13px] bg-emerald-500 hover:bg-emerald-600 text-white h-10 px-4"
                        asChild
                      >
                        <Link href="/items/add">
                          <PlusCircle className="h-[18px] w-[18px] mr-1.5" />
                          {t("addItemTitle")}
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("addItemTitle")}</p>
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="relative h-10 w-10 rounded-full border-2 border-primary/20 p-0"
                      >
                        <Avatar className="h-full w-full rounded-full">
                          <AvatarImage
                            src={user?.imageUrl}
                            alt={user?.fullName || ""}
                          />
                          <AvatarFallback className="rounded-full font-bold text-xs bg-primary/10 text-primary">
                            {user?.firstName?.charAt(0)}
                            {user?.lastName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-64 rounded-2xl p-2 shadow-xl border-zinc-200/50 dark:border-zinc-800/50"
                      sideOffset={8}
                    >
                      <div className="flex items-center gap-3 p-3">
                        <Avatar className="h-10 w-10 rounded-full border border-zinc-100 dark:border-zinc-800">
                          <AvatarImage src={user?.imageUrl} />
                          <AvatarFallback className="rounded-full font-bold text-xs bg-zinc-100 dark:bg-zinc-700">
                            {user?.firstName?.charAt(0)}
                            {user?.lastName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col space-y-0.5 overflow-hidden">
                          <p className="text-sm font-bold truncate text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                            <span className="truncate">{user?.fullName}</span>
                            {ownProfile?.is_verified && <VerifiedBadge />}
                          </p>
                          <p className="text-[10px] text-zinc-500 truncate font-medium">
                            {user?.primaryEmailAddress?.emailAddress}
                          </p>
                        </div>
                      </div>
                      <div className="p-1 space-y-1">
                        <DropdownMenuItem
                          onClick={() => router.push("/profile")}
                          className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-zinc-100 dark:focus:bg-zinc-800 transition-colors group"
                        >
                          <User className="mr-3 h-4 w-4 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
                          <span className="text-xs font-bold text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
                            {t("myPosts")}
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push("/profile?tab=info")}
                          className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-zinc-100 dark:focus:bg-zinc-800 transition-colors group"
                        >
                          <Settings className="mr-3 h-4 w-4 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
                          <span className="text-xs font-bold text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
                            {t("settings")}
                          </span>
                        </DropdownMenuItem>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {/* Login Button Mobile Only (if the user is not signed in) */}
            {!userId ? (
              <Button
                size="sm"
                className="sm:hidden rounded-lg font-bold text-[10px] h-9 bg-emerald-500 text-white px-3 capitalize"
                asChild
              >
                <Link href="/sign-up">{t("signup")}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}
