"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { Menu, LogOut, Search, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AdminNavLinks } from "@/components/admin/admin-sidebar";
import { useAdminSearch } from "@/lib/admin-search-context";
import { usePendingPostsCount } from "@/lib/hooks/use-admin-posts";
import { cn } from "@/lib/utils";

const SEARCH_PLACEHOLDERS: Record<string, string> = {
  "/admin/users": "Ҷустуҷӯи корбарон — ном, телефон, почта...",
  "/admin/posts": "Ҷустуҷӯи эълонҳо — сарлавҳа, тавсиф...",
};

export function AdminTopbar() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const { query, setQuery } = useAdminSearch();
  const { data: pendingCount = 0 } = usePendingPostsCount();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const name = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Admin" : "Admin";
  const initial = name.charAt(0).toUpperCase();
  const searchPlaceholder = SEARCH_PLACEHOLDERS[pathname];
  const searchable = !!searchPlaceholder;

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <header className="h-20 border-b border-zinc-100 bg-white sticky top-0 z-30 flex items-center gap-3 px-4 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden shrink-0 relative"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="w-5 h-5" />
        {pendingCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </Button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          <SheetHeader className="h-16 flex-row items-center px-6 border-b border-zinc-100 space-y-0">
            <SheetTitle className="text-sm font-bold tracking-tight text-blue-600">Administration</SheetTitle>
          </SheetHeader>
          <AdminNavLinks onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <div className="flex items-center gap-2 shrink-0">
        {searchable && (
          <>
            <div className={cn("relative overflow-hidden transition-all", searchOpen ? "w-72 sm:w-[28rem]" : "w-0")}>
              <Input
                autoFocus={searchOpen}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 rounded-full border-none bg-zinc-50 text-sm shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:border-none pr-8"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
              className="flex items-center justify-center w-9 h-9 rounded-full text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition-colors shrink-0"
            >
              <Search className="w-4 h-4" />
            </button>
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-full pl-1 pr-1.5 hover:bg-zinc-50 transition-colors shrink-0">
              <Avatar className="w-9 h-9 border border-zinc-100">
                <AvatarImage src={user?.imageUrl} alt={name} />
                <AvatarFallback className="bg-blue-600 text-white font-bold text-sm">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="hidden sm:block w-4 h-4 text-zinc-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 font-medium gap-2"
              onClick={() => signOut({ redirectUrl: "/" })}
            >
              <LogOut className="w-4 h-4" />
              Баромадан
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
