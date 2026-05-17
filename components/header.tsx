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
  Languages, 
  Search, 
  Home, 
  ChevronDown,
  User,
  X,
  LogOut,
  QrCode,
  PlusCircle,
  Settings,
  Menu,
  LayoutGrid,
  Briefcase,
  Bookmark,
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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { userId } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const { t, locale, setLocale } = useLanguage();
  
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || "");
  const [mounted, setMounted] = useState(false);

  // Пешгирии Hydration Mismatch: Танҳо баъди mount шудани компонент дар браузер 
  // мо иҷозат медиҳем, ки тарҷумаҳои ба locale вобаста рендер шаванд.
  useEffect(() => {
    setMounted(true);
  }, []);

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

  useEffect(() => {
    // Агар корбар чизе нанависад, ҳолати ҷустуҷӯро хомӯш мекунем
    if (searchValue === (searchParams.get('q') || "")) {
      window.dispatchEvent(new CustomEvent('search-active', { detail: false }));
      return;
    }

    // Ҳамин ки корбар ба навиштан оғоз кард, хабар медиҳем, ки ҷустуҷӯ фаъол аст
    window.dispatchEvent(new CustomEvent('search-active', { detail: true }));

    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (searchValue) {
        params.set('q', searchValue);
      } else {
        params.delete('q');
      }
      
      const newUrl = `/?${params.toString()}`;
      if (window.location.search !== `?${params.toString()}`) {
        router.push(newUrl, { scroll: false });
      }
      
      // Пас аз иваз шудани URL, як лаҳза мунтазир мешавем, ки React Query оғоз шавад
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('search-active', { detail: false }));
      }, 50);
    }, 150); // 150ms - суръати "Ultra-Live"

    return () => clearTimeout(delayDebounceFn);
  }, [searchValue, pathname, router, searchParams]);

  return (
    <TooltipProvider>
      <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white/95 backdrop-blur-sm dark:bg-zinc-950/95 border-b border-zinc-100 dark:border-zinc-900/50">
        <div className="w-full max-w-[1600px] mx-auto flex h-12 sm:h-16 items-center px-3 sm:px-4 gap-2 sm:gap-4">
          
          {/* Қисми чап: Логотип ва Паймоиш */}
          <div className="flex items-center gap-2 sm:gap-6 flex-initial sm:flex-1">
            <Link href="/" className="flex items-center space-x-2 shrink-0">
              <span className="text-base sm:text-2xl font-black tracking-[-0.1em] text-zinc-900 dark:text-zinc-100 uppercase">JUYO</span>
            </Link>

            {/* Паймоиши асосӣ барои Desktop */}
            <nav className="hidden lg:flex items-center space-x-1 bg-zinc-100/50 dark:bg-zinc-900/50 p-1 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
              {mounted && navLinks.map((link) => {
                const isQrTab = searchParams.get('tab') === 'qr';
                let isActive = false;

                if (link.value === 'qr') {
                  isActive = pathname === '/profile' && isQrTab;
                } else if (link.value === 'profile') {
                  isActive = pathname === '/profile' && !isQrTab;
                } else {
                  isActive = pathname === link.href;
                }

                // Функсия барои назорати дастӣ
                const handleNavClick = () => {
                  const isProtected = link.href.includes('/profile') || link.href.includes('/items/add');
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
                    className={`gap-2 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all border ${
                      isActive 
                        ? "bg-white shadow-sm text-zinc-900 border-emerald-500 ring-2 ring-emerald-500/20 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" 
                        : "text-zinc-500 hover:text-zinc-900 border-transparent focus:outline-none"
                    }`}
                  >
                    <link.icon className="h-3.5 w-3.5" />
                    {link.label}
                  </Button>
                );
              })}
            </nav>
          </div>

          {/* Қисми миёна: Сатри ҷустуҷӯ (Марказонидашуда) */}
          <div className={`flex-[2] sm:flex-[1.5] max-w-xl relative ${pathname !== '/' ? 'invisible pointer-events-none' : 'block'}`}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <Input
              placeholder={t('search')}
              className="pl-8 h-8 rounded-xl sm:rounded-full bg-zinc-100/50 border border-zinc-200 focus-visible:ring-2 focus-visible:ring-primary/20 transition-all text-[10px] w-full"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            {searchValue && (
              <button 
                onClick={() => setSearchValue("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Қисми рост: Интихоби забон ва аутентификатсия */}
          <div className="flex items-center gap-1.5 flex-initial sm:flex-1 justify-end shrink-0">
            {/* Интихоби забон */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="flex gap-2 rounded-md font-bold text-zinc-600 cursor-pointer border border-emerald-500 ring-2 ring-emerald-500/20 transition-all bg-white shadow-sm focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 h-9 px-3">
                  <span className="text-[10px] font-black dark:text-zinc-100 ">
                    {mounted ? languages.find(l => l.code === locale)?.label : languages.find(l => l.code === 'tg')?.label}
                  </span>
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

            {/* User Button / Login (Танҳо барои Desktop) */}
            <div className="hidden sm:flex items-center space-x-2">
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
                          onClick={() => router.push('/profile?tab=guide')} 
                          className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-zinc-100 dark:focus:bg-zinc-800 transition-colors group"
                        >
                          <Settings className="mr-3 h-4 w-4 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
                          <span className="text-xs font-bold text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
                            {t('aboutApp') || 'Оид ба барнома'}
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-2" />
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

            {/* Login Button Mobile Only (Агар корбар ворид нашуда бошад) */}
            {!userId ? (
              <Button size="sm" className="sm:hidden rounded-md font-bold text-[10px] h-9 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-3 capitalize" asChild>
                <Link href="/sign-up">{t('signup')}</Link>
              </Button>
            ) : (
              /* Mobile Menu Button (Агар корбар ворид шуда бошад) */
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="sm:hidden h-9 w-9 p-0 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                    <Menu className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-xl border-zinc-200/50 dark:border-zinc-800/50">
                  <div className="p-1 space-y-0.5">
                    <DropdownMenuItem 
                      onClick={() => router.push('/profile?tab=posts')} 
                      className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-zinc-100 dark:focus:bg-zinc-800 transition-colors group"
                    >
                      <LayoutGrid className="mr-3 h-4 w-4 text-blue-500" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">{t('myPosts')}</span>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onClick={() => router.push('/profile?tab=info')} 
                      className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-zinc-100 dark:focus:bg-zinc-800 transition-colors group"
                    >
                      <User className="mr-3 h-4 w-4 text-indigo-500" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">{t('personalInfo')}</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                      onClick={() => router.push('/profile?tab=qr')} 
                      className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-zinc-100 dark:focus:bg-zinc-800 transition-colors group"
                    >
                      <QrCode className="mr-3 h-4 w-4 text-purple-500" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">{t('qrMyCode')}</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                      onClick={() => router.push('/profile?tab=saved')} 
                      className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-zinc-100 dark:focus:bg-zinc-800 transition-colors group"
                    >
                      <Bookmark className="mr-3 h-4 w-4 text-emerald-500" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">{t('savedItems')}</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                      onClick={() => router.push('/profile?tab=safety')} 
                      className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-zinc-100 dark:focus:bg-zinc-800 transition-colors group"
                    >
                      <Briefcase className="mr-3 h-4 w-4 text-amber-500" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">{t('mySafe')}</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                      onClick={() => router.push('/profile?tab=guide')} 
                      className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-zinc-100 dark:focus:bg-zinc-800 transition-colors group"
                    >
                      <Menu className="mr-3 h-4 w-4 text-zinc-500" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">{t('aboutApp')}</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-2 my-1" />
                    
                    <DropdownMenuItem 
                      onClick={() => signOut(() => router.push("/"))} 
                      className="rounded-xl cursor-pointer py-2.5 px-3 focus:bg-red-50 dark:focus:bg-red-950/30 transition-colors group"
                    >
                      <LogOut className="mr-3 h-4 w-4 text-red-500" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-red-600">{t('signOut')}</span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}
