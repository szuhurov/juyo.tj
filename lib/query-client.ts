/**
 * React Query configuration for data management.
 * Provides caching and automatic refreshing of data.
 *
 * Sibling of app/lib/query-client.ts, but intentionally different: the web
 * also renders on the server, the app does not.
 */
import { QueryClient } from "@tanstack/react-query"; // This is for caching data

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes: data is considered fresh for 5 mins
        gcTime: 1000 * 60 * 30, // 30 minutes: keep data in cache even if not used
        refetchOnWindowFocus: false, // don't refetch when user switches tabs
        retry: 1, // retry only once if fetch fails
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Server: a NEW client per request. A module-level client was shared by every
 * request on the server — the first request's `initialData` (e.g. the home
 * list) stayed cached there, so later server HTML showed that old list and it
 * swapped after hydration.
 * Browser: one client for the whole session, so the cache survives navigation.
 */
export function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
