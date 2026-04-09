"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UserButton, useAuth } from "@clerk/nextjs";
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
  X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
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
  const { t, locale, setLocale } = useLanguage();
  
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || "");

  const languages = [
    { code: "tg", label: "Тоҷикӣ" },
    { code: "ru", label: "Русский" },
    { code: "en", label: "English" },
  ];

  const navLinks = [
    { href: "/", value: "home", label: t('home'), icon: Home },
    { href: "/profile", value: "profile", label: t('profile'), icon: User },
  ];

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
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md dark:bg-zinc-950/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 gap-4">
          <div className="flex items-center gap-8 flex-1">
            <Link href="/" className="flex items-center space-x-2 shrink-0">
              <span className="text-2xl font-black tracking-tighter text-zinc-900 dark:text-zinc-100">JUYO</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1 bg-zinc-100/50 dark:bg-zinc-900/50 p-1 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={pathname === link.href ? "secondary" : "ghost"}
                    size="sm"
                    className={`gap-2 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all ${
                      pathname === link.href 
                        ? "bg-white shadow-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" 
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    <link.icon className="h-3.5 w-3.5" />
                    {link.label}
                  </Button>
                </Link>
              ))}
            </nav>

            {/* Global Search Bar */}
            <div className="hidden sm:flex relative flex-1 max-w-md">
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

          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2">
              <div className="hidden sm:flex items-center mr-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm" className="flex gap-2 rounded-md font-bold text-zinc-600 cursor-pointer">
                      <Languages className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
                      <span className="text-xs">{languages.find(l => l.code === locale)?.label}</span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 rounded-xl">
                    {languages.map((lang) => (
                      <DropdownMenuItem
                        key={lang.code}
                        onClick={() => setLocale(lang.code as any)}
                        className={`font-bold text-xs uppercase tracking-tight cursor-pointer ${locale === lang.code ? "text-primary" : ""}`}
                      >
                        {lang.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {userId ? (
                /* LOGGED IN STATE */
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" className="hidden sm:flex rounded-lg font-black text-[10px] uppercase tracking-wider bg-zinc-900 text-white hover:bg-zinc-800 shadow-md h-9 px-4" asChild>
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
                  <UserButton 
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox: "h-9 w-9 rounded-xl border-2 border-primary/20 shadow-sm"
                      }
                    }}
                  />
                </div>
              ) : (
                /* LOGGED OUT STATE */
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" className="font-bold text-xs text-zinc-600 hover:text-zinc-900 dark:hover:text-white h-9 px-4" asChild>
                    <Link href="/sign-in">{t('login')}</Link>
                  </Button>
                  <Button size="sm" className="hidden sm:flex rounded-md font-black text-[10px]  tracking-wider bg-zinc-900 text-white hover:bg-zinc-800 shadow-md h-9 px-4" asChild>
                    <Link href="/sign-up">{t('signup')}</Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile Nav */}
            <div className="flex items-center gap-1 md:hidden">
              {userId && (
                <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "h-8 w-8 rounded-lg border border-zinc-200 shadow-sm"
                    }
                  }}
                />
              )}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-lg">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="flex flex-col space-y-6 mt-8">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      placeholder={t('search')}
                      className="pl-9 h-10 rounded-xl bg-zinc-100 border border-zinc-200"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    {navLinks.map((link) => (
                      <Link key={link.href} href={link.href}>
                        <Button
                          variant={pathname === link.href ? "secondary" : "ghost"}
                          className={`w-full justify-start gap-4 rounded-xl font-bold uppercase text-xs tracking-widest ${
                            pathname === link.href ? "text-primary bg-primary/5" : "text-zinc-500"
                          }`}
                        >
                          <link.icon className="h-5 w-5" />
                          {link.label}
                        </Button>
                      </Link>
                    ))}
                  </div>
                  
                  {!userId && (
                    <div className="grid grid-cols-2 gap-2 pt-4">
                      <Button variant="secondary" className="rounded-xl font-bold text-xs" asChild>
                        <Link href="/sign-in">{t('login')}</Link>
                      </Button>
                      <Button className="rounded-xl font-bold text-xs bg-zinc-900 text-white hover:bg-zinc-800" asChild>
                        <Link href="/sign-up">{t('signup')}</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
    </TooltipProvider>
  );
}
