"use client";

/**
 * Провайдери React Query.
 * Ин компонент барои идоракунии кэш ва запросҳо (data fetching) дар тамоми барнома лозим аст.
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/lib/query-client";
import { ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    // Провайдери асосӣ, ки QueryClient-ро ба тамоми компонентҳо дастрас мекунад
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Асбоби девелоперӣ барои дидани ҳолати запросҳо */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
