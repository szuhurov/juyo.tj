"use client";

/**
 * Қисмати сарлавҳаи асосии барнома (Header).
 * Ин компонент паймоиш (navigation), ҷустуҷӯ, ивази забон ва менюи корбарро дар бар мегирад.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import {
  Search,
  Home,
  User,
  X,
  LogOut,
  QrCode,
  PlusCircle,
  Settings,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useHomeState } from "@/lib/home-context";
import type { Item } from "@/lib/services/item-service";
import { NotificationBell } from "@/components/notification-bell";
import { VerifiedBadge } from "@/components/verified-badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Ин ду компонент (модали камера, ҷустуҷӯи визуалӣ) дар Header ҳастанд, ки
// дар ҲАМАИ саҳифаҳо render мешавад — вале аксари ташрифҳо ҳеҷ гоҳ онҳоро
// намекушоянд. next/dynamic JS-и онҳоро аз bundle-и асосии ҳар саҳифа ҷудо
// мекунад (chunk-и алоҳида), то first-load JS-и умумии барнома камтар шавад.
const VisualSearchModal = dynamic(() =>
  import("./visual-search-modal").then((m) => m.VisualSearchModal),
);
const CameraCaptureModal = dynamic(() =>
  import("./camera-capture-modal").then((m) => m.CameraCaptureModal),
);

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const onQrTab = pathname === "/profile" && searchParams.get("tab") === "qr";

  const { userId } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  // Барои нишони "тасдиқшуда" дар паҳлӯи номи худи корбар — public_profiles
  // ба ҳама намоён аст, пас токен лозим нест.
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

  // Иконаи ҷустуҷӯи визуалӣ танҳо вақте намоён аст, ки AI фаъол аст — бе он
  // embedding сохта намешавад ва ҷустуҷӯи аксӣ натиҷа намедиҳад.
  const { data: appSettings } = useQuery({
    queryKey: ["app-settings-ai-enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("ai_moderation_enabled")
        .eq("id", true)
        .maybeSingle();
      return data;
    },
    staleTime: 60 * 1000,
  });
  const aiEnabled = appSettings?.ai_moderation_enabled ?? false;

  const { t } = useLanguage();
  const { setVisualSearchResults, setIsSearchTyping, triggerGoHome } =
    useHomeState();

  const [searchValue, setSearchValue] = useState(searchParams.get("q") || "");
  const [mounted, setMounted] = useState(false);
  const [isVisualSearchOpen, setIsVisualSearchOpen] = useState(false);
  const [directFile, setDirectFile] = useState<File | null>(null);
  const [showPhotoChoice, setShowPhotoChoice] = useState(false);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const navLinks = [
    { href: "/", value: "home", label: t("home"), icon: Home },
    { href: "/profile", value: "profile", label: t("profile"), icon: User },
    {
      href: "/profile?tab=qr",
      value: "qr",
      label: t("qrMyCode"),
      icon: QrCode,
    },
  ];

  // Пешгирии Hydration Mismatch — синхронизатсияи "клиент омода аст" бо
  // ягона роҳи имконпазир: effect (native browser API аст, на state аз рендер).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handlePhotoPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDirectFile(file);
      setIsVisualSearchOpen(true);
    }
    e.target.value = "";
  };

  const handleCameraCapture = (file: File) => {
    setDirectFile(file);
    setIsVisualSearchOpen(true);
  };

  const handleVisualSearchResults = (items: Item[]) => {
    setVisualSearchResults(items);
    setDirectFile(null);
    // Results only render on the home feed — jump there if triggered elsewhere.
    if (pathname !== "/") {
      triggerGoHome();
      router.push("/", { scroll: false });
    }
  };

  // Keep latest pathname/searchParams in refs so the typing-driven effect below
  // can read current route info without re-firing merely because the route changed
  // (that re-firing was the bug: leftover search text hijacked every navigation,
  // bouncing the user back to"/?q=..."the moment they clicked into an item).
  const pathnameRef = useRef(pathname);
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    pathnameRef.current = pathname;
    searchParamsRef.current = searchParams;
  }, [pathname, searchParams]);

  // Sync the box FROM the URL whenever we land on home — fixes the search box
  // showing stale text after browser back/forward or after navigating home
  // via a link/route that doesn't go through this input.
  useEffect(() => {
    // Синхронизатсия АЗ URL (система берун аз React) — маҳз ҳамин барои effect аст.
    if (pathname === "/") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchValue(searchParams.get("q") || "");
    }
  }, [pathname, searchParams]);

  // Fires only when the user actually types (searchValue changes) — not on
  // unrelated route changes — so it can never hijack navigation.
  useEffect(() => {
    const currentPathname = pathnameRef.current;
    const currentSearchParams = searchParamsRef.current;

    // Off the home feed, typing has nothing local to debounce against yet —
    // jump to home immediately so the query below can take over there.
    if (currentPathname !== "/") {
      if (!searchValue) return;
      triggerGoHome();
      router.push(`/?q=${encodeURIComponent(searchValue)}`, { scroll: false });
      return;
    }

    if (searchValue === (currentSearchParams.get("q") || "")) {
      setIsSearchTyping(false);
      return;
    }

    setIsSearchTyping(true);

    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(currentSearchParams);
      if (searchValue) {
        params.set("q", searchValue);
      } else {
        params.delete("q");
      }

      const newUrl = `/?${params.toString()}`;
      if (window.location.search !== `?${params.toString()}`) {
        router.push(newUrl, { scroll: false });
      }

      setTimeout(() => setIsSearchTyping(false), 50);
    }, 150);

    return () => clearTimeout(delayDebounceFn);
  }, [searchValue, router, setIsSearchTyping, triggerGoHome]);

  /**
   * Дар табби QR бари болоӣ ТАМОМАН нишон дода намешавад.
   *
   * Он саҳифа ба ҷустуҷӯ ҳеҷ рабте надорад — он ҷо корбар стикери худро
   * танзим мекунад. Талаби корбар: ҳам ҷустуҷӯ, ҳам занги огоҳиномаҳо
   * бардошта шаванд, то интихобгари сатҳҳо дар сари саҳифа истад.
   *
   * Ҳамаи hook-ҳо БОЛОИ ин сатр меистанд — return-и барвақт пеш аз онҳо
   * тартиби hook-ҳоро вайрон мекард.
   */
  if (onQrTab) return null;

  return (
    <TooltipProvider>
      <header
        data-nosnippet
        className="fixed top-0 left-0 right-0 z-50 w-full bg-canvas"
      >
        <div className="w-full max-w-7xl mx-auto flex h-12 sm:h-16 items-center px-2.5 sm:px-4 gap-2 sm:gap-4">
          {/* Қисми чап: Логотип ва Паймоиш.
              `hidden sm:flex`: дар мобил мазмуни он холист (матни логотип
              `hidden sm:inline` аст, паймоиш desktop-ӣ), вале ҳамчун элементи
              flex ҳанӯз як `gap` (8px) мегирифт — аз ин сабаб майдони ҷустуҷӯ
              дар 18px меистод, дар ҳоле ки шофияи кортҳо 10px аст. */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-6 flex-initial sm:flex-1">
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

            {/* Паймоиши асосӣ барои Desktop */}
            <nav className="hidden lg:flex items-center space-x-1 bg-zinc-100/50 dark:bg-zinc-800/50 p-1 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
              {mounted &&
                navLinks.map((link) => {
                  const isQrTab = searchParams.get("tab") === "qr";
                  let isActive = false;

                  if (link.value === "qr") {
                    isActive = pathname === "/profile" && isQrTab;
                  } else if (link.value === "profile") {
                    isActive = pathname === "/profile" && !isQrTab;
                  } else {
                    isActive = pathname === link.href;
                  }

                  // Функсия барои назорати дастӣ
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
                      className={`gap-2 rounded-md font-bold text-[13px] min-[1503px]:text-sm tracking-wider transition-all border ${
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

          {/* Қисми миёна: Сатри ҷустуҷӯ (Марказонидашуда) */}
          <div className="flex-[2] sm:flex-[1.5] max-w-xl relative block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 min-[1084px]:h-4 min-[1084px]:w-4 text-zinc-400" />
            <Input
              placeholder={t("search")}
              className="pl-9 pr-10 h-9 sm:h-10 min-[1084px]:h-11 min-[1503px]:h-12 rounded-xl bg-white dark:bg-zinc-800 border-none shadow-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-emerald-300 dark:focus-visible:border-emerald-800 transition-all text-[11px] min-[1084px]:text-xs min-[1503px]:text-sm w-full"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {searchValue && (
                <button
                  onClick={() => setSearchValue("")}
                  aria-label={t("clearFilter") || "Тоза кардан"}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => setShowPhotoChoice(true)}
                className={cn(
                  "p-1.5 text-zinc-400 hover:text-zinc-600 transition-colors",
                  !aiEnabled && "hidden",
                )}
                title={t("visualSearchTitle") || "Ҷустуҷӯ бо акс"}
              >
                <Camera className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Қисми рост: Аутентификатсия. Ивази забон акнун аз Профил → Маълумоти шахсӣ
              сурат мегирад, на аз ин ҷо — ниг. app/(main)/profile/page.tsx */}
          <div className="flex items-center gap-1.5 flex-initial sm:flex-1 justify-end shrink-0">
            {mounted && userId && <NotificationBell />}

            {/* User Button / Login (Танҳо барои Desktop) */}
            <div className="hidden sm:flex items-center space-x-2">
              {!userId ? (
                <div className="flex items-center gap-2">
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
                  <Button
                    variant="secondary"
                    size="sm"
                    className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100 h-10 px-3 border-none rounded-md bg-white dark:bg-zinc-800 hover:bg-zinc-100"
                    asChild
                  >
                    <Link href="/sign-in">{t("login")}</Link>
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-md font-bold text-[13px] bg-emerald-500 text-white hover:bg-emerald-600 h-10 px-4"
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
                      <div className="flex items-center gap-3 p-3 mb-1">
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
                      <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-700 mx-2" />
                      <div className="p-1 space-y-1">
                        <DropdownMenuItem
                          onClick={() => router.push("/profile")}
                          className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-zinc-100 dark:focus:bg-zinc-800 transition-colors group"
                        >
                          <User className="mr-3 h-4 w-4 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
                          <span className="text-xs font-bold text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
                            {t("manageAccount")}
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
                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-700 mx-2" />
                        <DropdownMenuItem
                          onClick={() => signOut(() => router.push("/"))}
                          className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-red-50 dark:focus:bg-red-950/30 transition-colors group"
                        >
                          <LogOut className="mr-3 h-4 w-4 text-red-500" />
                          <span className="text-xs font-bold text-red-600">
                            {t("signOut")}
                          </span>
                        </DropdownMenuItem>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {/* Login Button Mobile Only (Агар корбар ворид нашуда бошад) */}
            {!userId ? (
              <Button
                size="sm"
                className="sm:hidden rounded-md font-bold text-[10px] h-9 bg-emerald-500 text-white px-3 capitalize"
                asChild
              >
                <Link href="/sign-up">{t("signup")}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <VisualSearchModal
        isOpen={isVisualSearchOpen}
        onClose={() => {
          setIsVisualSearchOpen(false);
          setDirectFile(null);
        }}
        onResults={handleVisualSearchResults}
        directFile={directFile}
      />

      {mounted && (
        <>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            ref={galleryInputRef}
            onChange={handlePhotoPicked}
          />

          <Dialog open={showPhotoChoice} onOpenChange={setShowPhotoChoice}>
            <DialogContent className="max-w-[320px] rounded-[1.5rem] p-5 pt-11 border-none shadow-2xl gap-4 focus:ring-0 focus:outline-none">
              <DialogHeader className="mb-2">
                <DialogTitle className="text-lg font-bold tracking-tight text-center text-emerald-600">
                  {t("choose_photo_method")}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="flex flex-col gap-2 h-24 rounded-2xl bg-white border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 group transition-all focus:ring-0 focus-visible:ring-0 outline-none shadow-none"
                  onClick={() => {
                    setShowPhotoChoice(false);
                    setShowCameraCapture(true);
                  }}
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white transition-all">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold tracking-wide text-zinc-500">
                    {t("camera")}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col gap-2 h-24 rounded-2xl bg-white border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 group transition-all focus:ring-0 focus-visible:ring-0 outline-none shadow-none"
                  onClick={() => {
                    setShowPhotoChoice(false);
                    galleryInputRef.current?.click();
                  }}
                >
                  <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center text-white transition-all">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold tracking-wide text-zinc-500">
                    {t("gallery")}
                  </span>
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <CameraCaptureModal
            isOpen={showCameraCapture}
            onClose={() => setShowCameraCapture(false)}
            onCapture={handleCameraCapture}
          />
        </>
      )}
    </TooltipProvider>
  );
}
