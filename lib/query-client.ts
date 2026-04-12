import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes: data is considered fresh for 5 mins
      gcTime: 1000 * 60 * 30, // 30 minutes: keep data in cache even if not used
      refetchOnWindowFocus: false, // don't refetch when user switches tabs
      retry: 1, // retry only once if fetch fails
    },
  },
});
