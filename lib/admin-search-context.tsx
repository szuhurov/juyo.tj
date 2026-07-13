"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const AdminSearchContext = createContext<{ query: string; setQuery: (q: string) => void } | null>(null);

export function AdminSearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const pathname = usePathname();

  // Ҷустуҷӯ ба саҳифаи ҷорӣ вобаста аст — ҳангоми гузариш ба саҳифаи дигар тоза мешавад.
  useEffect(() => {
    setQuery("");
  }, [pathname]);

  return <AdminSearchContext.Provider value={{ query, setQuery }}>{children}</AdminSearchContext.Provider>;
}

export function useAdminSearch() {
  const ctx = useContext(AdminSearchContext);
  if (!ctx) throw new Error("useAdminSearch must be used within AdminSearchProvider");
  return ctx;
}
