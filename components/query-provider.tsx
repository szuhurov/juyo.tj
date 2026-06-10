"use client";

/**
 * Провайдери React Query.
 * Ин компонент барои идоракунии кэш ва запросҳо (data fetching) дар тамоми барнома лозим аст.
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
