"use client";

/**
 * React Query provider.
 * This component is needed for managing cache and data fetching throughout the app.
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
