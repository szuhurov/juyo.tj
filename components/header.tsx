"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { 
  Languages, 
  PlusCircle, 
  Search, 
  Home, 
  Menu,
  ChevronDown,
  User,
  X,
  LogOut,
  QrCode,
  ShieldCheck,
  Bookmark,
  List,
  Settings,
  Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { t, locale, setLocale } = useLanguage();
  
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || "");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const languages = [
    { code: "tg", label: "Тоҷикӣ" },
    { code: "ru", label: "Русский" },
    { code: "en", label: "English" },
  ];

  const navLinks = [
    { href: "/", value: "home", label: t('home'), icon: Home },
    { href: "/profile", value: "profile", label: t('profile'), icon: User },
    { href: "/profile?tab=qr", value: "qr", label: "QR-коди ман", icon: QrCode },
  ];

  const profileLinks = [
    { href: "/profile?tab=posts", label: t('myPosts') || "My Posts", icon: List },
    { href: "/profile?tab=info", label: t('personalInfo') || "Personal Information", icon: User },
    { href: "/profile?tab=qr", label: t('qrMyCode') || "My QR Code", icon: QrCode },
    { href: "/profile?tab=saved", label: t('savedItems') || "Saved Items", icon: Bookmark },
    { href: "/profile?tab=safety", label: t('mySafe') || "My Safety Box", icon: ShieldCheck },
  ];

  // Close menu when a link is clicked
  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  // Handle live search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (searchValue) {
        params.set('q', searchValue);
      } else {
        params.delete('q');
      }
      
      if (pathname === '/' || searchValue) {
        router.push(`/?${params.toString()}`);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchValue]);

  return (
    <TooltipProvider>
      <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white/80 backdrop-blur-md dark:bg-zinc-950/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 gap-2 sm:gap-4">
          <div className="flex items-center gap-4 sm:gap-8 flex-1 min-w-0">
            <Link href="/" className="flex items-center space-x-2 shrink-0">
              <span className="text-xl sm:text-2xl font-black tracking-[-0.1em] text-zinc-900 dark:text-zinc-100 uppercase">JUYO</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1 bg-zinc-100/50 dark:bg-zinc-900/50 p-1 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
              {navLinks.map((link) => {
                const isQrTab = searchParams.get('tab') === 'qr';
                let isActive = false;

                if (link.value === 'qr') {
                  isActive = pathname === '/profile' && isQrTab;
                } else if (link.value === 'profile') {
                  isActive = pathname === '/profile' && !isQrTab;
                } else {
                  isActive = pathname === link.href;
                }
                
                return (
                  <Link key={link.href} href={link.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      className={`gap-2 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all border ${
                        isActive 
                          ? "bg-white shadow-sm text-zinc-900 border-emerald-500 ring-2 ring-emerald-500/20 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" 
                          : "text-zinc-500 hover:text-zinc-900 border-transparent focus:outline-none"
                      }`}
                    >
                      <link.icon className="h-3.5 w-3.5" />
                      {link.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>

            {/* Global Search Bar (Desktop) */}
            <div className="hidden md:flex relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder={t('search')}
                className="pl-9 h-9 rounded-full bg-zinc-100/50 border border-zinc-200 focus-visible:ring-2 focus-visible:ring-primary/20 transition-all text-xs"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
              {searchValue && (
                <button 
                  onClick={() => setSearchValue("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Desktop: Language THEN Auth */}
            <div className="hidden sm:flex items-center space-x-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="flex gap-2 rounded-md font-bold text-zinc-600 cursor-pointer border border-emerald-500 ring-2 ring-emerald-500/20 transition-all bg-white shadow-sm focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 h-9 px-3">
                    <Languages className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
                    <span className="text-[10px] font-black">{languages.find(l => l.code === locale)?.label}</span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-xl">
                  {languages.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      onClick={() => setLocale(lang.code as any)}
                      className={`font-bold text-xs uppercase tracking-tight cursor-pointer ${locale === lang.code ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20" : ""}`}
                    >
                      {lang.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {!userId ? (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" className="font-bold text-[10px] text-zinc-900 dark:text-zinc-100 h-9 px-3 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100" asChild>
                    <Link href="/sign-in">{t('login')}</Link>
                  </Button>
                  <Button size="sm" className="rounded-md font-bold text-[10px] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 h-9 px-4" asChild>
                    <Link href="/sign-up">{t('signup')}</Link>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" className="rounded-lg font-black text-[10px] bg-zinc-900 text-white hover:bg-zinc-800 shadow-md h-9 px-4" asChild>
                        <Link href="/items/add">
                          <PlusCircle className="h-4 w-4 mr-1.5" />
                          {t('addItemTitle')}
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('addItemTitle')}</p>
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-9 w-9 rounded-full border-2 border-primary/20 shadow-sm p-0">
                        <Avatar className="h-full w-full rounded-full">
                          <AvatarImage src={user?.imageUrl} alt={user?.fullName || ""} />
                          <AvatarFallback className="rounded-full font-bold text-xs bg-primary/10 text-primary">
                            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-xl border-zinc-200/50 dark:border-zinc-800/50" sideOffset={8}>
                      <div className="flex items-center gap-3 p-3 mb-1">
                        <Avatar className="h-10 w-10 rounded-full border border-zinc-100 dark:border-zinc-800">
                          <AvatarImage src={user?.imageUrl} />
                          <AvatarFallback className="rounded-full font-bold text-xs bg-zinc-100 dark:bg-zinc-800">
                            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col space-y-0.5 overflow-hidden">
                          <p className="text-sm font-black truncate text-zinc-900 dark:text-zinc-100">{user?.fullName}</p>
                          <p className="text-[10px] text-zinc-500 truncate font-medium">{user?.primaryEmailAddress?.emailAddress}</p>
                        </div>
                      </div>
                      <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-2" />
                      <div className="p-1 space-y-1">
                        <DropdownMenuItem 
                          onClick={() => router.push('/profile')} 
                          className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-zinc-100 dark:focus:bg-zinc-800 transition-colors group"
                        >
                          <User className="mr-3 h-4 w-4 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
                          <span className="text-xs font-bold text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
                            {t('manageAccount')}
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => signOut(() => router.push("/"))} 
                          className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-red-50 dark:focus:bg-red-950/30 transition-colors group"
                        >
                          <LogOut className="mr-3 h-4 w-4 text-red-500" />
                          <span className="text-xs font-bold text-red-600">
                            {t('signOut')}
                          </span>
                        </DropdownMenuItem>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {/* Mobile: Language THEN Sign Up THEN Menu */}
            <div className="flex md:hidden items-center gap-1.5">
              {/* Language Selector (Mobile) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="flex gap-1 rounded-md font-black text-zinc-900 dark:text-zinc-100 cursor-pointer border border-emerald-500 ring-2 ring-emerald-500/20 transition-all bg-white dark:bg-zinc-900 shadow-sm h-9 px-2">
                    <span className="text-[10px] font-black">{languages.find(l => l.code === locale)?.label}</span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-xl">
                  {languages.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      onClick={() => setLocale(lang.code as any)}
                      className={`font-bold text-xs uppercase tracking-tight cursor-pointer ${locale === lang.code ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20" : ""}`}
                    >
                      {lang.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {!userId ? (
                <Button size="sm" className="rounded-md font-bold text-[10px] h-9 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 px-3 capitalize" asChild>
                  <Link href="/sign-up">{t('signup')}</Link>
                </Button>
              ) : null}

              {/* Mobile Nav Button (Trigger) */}
              <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9 bg-zinc-100 dark:bg-zinc-900">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[85vw] sm:w-80 p-0 flex flex-col border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                  <SheetHeader className="sr-only">
                    <SheetTitle>{t('menu')}</SheetTitle>
                    <SheetDescription>{t('menuDescription')}</SheetDescription>
                  </SheetHeader>
                  
                  {/* Menu Top Section with User Profile */}
                  <div className="p-6 pt-12 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                    {userId ? (
                      <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14 rounded-2xl border-2 border-emerald-500 shadow-md">
                          <AvatarImage src={user?.imageUrl} />
                          <AvatarFallback className="rounded-2xl font-black text-xl bg-emerald-100 text-emerald-600">
                            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col space-y-0.5 overflow-hidden">
                          <p className="text-lg font-black truncate text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">{user?.fullName}</p>
                          <p className="text-xs text-zinc-500 truncate font-bold">{user?.primaryEmailAddress?.emailAddress}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-2xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                            <User className="h-6 w-6 text-zinc-400" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">{t('welcome') || "Welcome to JUYO"}</p>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">{t('loginSubtitle') || "Login to your account"}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" className="rounded-md font-bold text-xs uppercase tracking-widest h-10 border-zinc-200 dark:border-zinc-800" asChild onClick={handleLinkClick}>
                            <Link href="/sign-in">{t('login')}</Link>
                          </Button>
                          <Button className="rounded-md font-bold text-xs uppercase tracking-widest h-10 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200" asChild onClick={handleLinkClick}>
                            <Link href="/sign-up">{t('signup')}</Link>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Menu Links */}
                  <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
                    {/* Main Nav Section */}
                    <div className="space-y-2">
                      <h4 className="px-4 text-[10px] font-black text-zinc-400 mb-4">{t('home') || "Main"}</h4>
                      <Link href="/" className="block" onClick={handleLinkClick}>
                        <Button
                          variant={pathname === "/" ? "secondary" : "ghost"}
                          className={`w-full justify-start gap-4 h-12 rounded-xl font-bold uppercase text-xs tracking-widest transition-all ${
                            pathname === "/" 
                              ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-l-4 border-emerald-500 rounded-l-none" 
                              : "text-zinc-500 border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900"
                          }`}
                        >
                          <Home className="h-5 w-5" />
                          {t('home')}
                        </Button>
                      </Link>
                      <Link href="/items/add" className="block" onClick={handleLinkClick}>
                        <Button
                          variant={pathname === "/items/add" ? "secondary" : "ghost"}
                          className={`w-full justify-start gap-4 h-12 rounded-xl font-bold uppercase text-xs tracking-widest transition-all ${
                            pathname === "/items/add" 
                              ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-l-4 border-emerald-500 rounded-l-none" 
                              : "text-zinc-500 border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900"
                          }`}
                        >
                          <PlusCircle className="h-5 w-5" />
                          {t('addItemTitle')}
                        </Button>
                      </Link>
                    </div>

                    {/* Profile Section (Only if logged in) */}
                    {userId && (
                      <div className="space-y-2">
                        <h4 className="px-4 text-[10px] font-black text-zinc-400 mb-4">{t('profile') || "Account"}</h4>
                        {profileLinks.map((link) => {
                          const isQrTab = searchParams.get('tab') === 'qr';
                          const isActive = link.href === "/profile?tab=qr" 
                            ? (pathname === "/profile" && isQrTab)
                            : (pathname === link.href);
                          
                          return (
                            <Link key={link.href} href={link.href} className="block" onClick={handleLinkClick}>
                              <Button
                                variant={isActive ? "secondary" : "ghost"}
                                className={`w-full justify-start gap-4 h-12 rounded-xl font-bold uppercase text-xs tracking-widest transition-all ${
                                  isActive 
                                    ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-l-4 border-emerald-500 rounded-l-none" 
                                    : "text-zinc-500 border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                }`}
                              >
                                <link.icon className="h-5 w-5" />
                                {link.label}
                              </Button>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Menu Bottom Section */}
                  {userId && (
                    <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                      <Button 
                        onClick={() => signOut(() => {
                          setIsMenuOpen(false);
                          router.push("/");
                        })} 
                        variant="ghost" 
                        className="w-full justify-start gap-4 h-12 rounded-md font-black uppercase text-xs tracking-widest text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                      >
                        <LogOut className="h-5 w-5" />
                        {t('signOut')}
                      </Button>
                    </div>
                  )}
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}
