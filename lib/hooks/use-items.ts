/**
 * Custom hooks for working with posts (Items Hooks).
 * This file uses React Query for fetching data, caching, and automatically refreshing the item list.
 */

import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Item, ItemService } from "@/lib/services/item-service";

export interface ItemFilters {
  search?: string;
  category?: string;
  type?: string | null;
  user_id?: string;
  dateFrom?: string;
  dateTo?: string;
  locationType?: string;
  city?: string;
  page?: number;
  pageSize?: number;
}

export const ITEM_KEYS = {
  all: ["items"] as const,
  lists: () => [...ITEM_KEYS.all, "list"] as const,
  list: (filters: ItemFilters) => [...ITEM_KEYS.lists(), { filters }] as const,
  details: () => [...ITEM_KEYS.all, "detail"] as const,
  detail: (id: string) => [...ITEM_KEYS.details(), id] as const,
  user: () => [...ITEM_KEYS.all, "user"] as const,
  userItems: (userId: string) => [...ITEM_KEYS.user(), userId] as const,
  vip: () => [...ITEM_KEYS.all, "vip"] as const,
  saved: () => [...ITEM_KEYS.all, "saved"] as const,
  savedItems: (userId: string) => [...ITEM_KEYS.saved(), userId] as const,
};

const PAGE_SIZE = 20;
const MAX_PAGES = 10; // Maximum number of pages kept in memory (200 items)

// initialItems — the first page of results, already fetched on the server
// (Server Component) (see app/(main)/page.tsx) — React Query uses it as
// "page 0" of the cache, so the initial HTML already has the items (for
// Google/SEO), without waiting for a client-side fetch.
// This only applies to the DEFAULT query (the default filters, which were
// fetched on the server) — once the user changes a filter, the queryKey
// changes and a normal client-side fetch happens.
export function useItems(filters?: ItemFilters, initialItems?: Item[]) {
  return useInfiniteQuery({
    queryKey: ITEM_KEYS.list(filters || {}),
    queryFn: ({ pageParam = 0, signal }) =>
      ItemService.getItems(
        { ...filters, page: pageParam, pageSize: PAGE_SIZE },
        undefined,
        { signal },
      ),
    getNextPageParam: (lastPage, allPages) => {
      if (allPages.length >= MAX_PAGES) return undefined;
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5,
    maxPages: MAX_PAGES,
    ...(initialItems
      ? { initialData: { pages: [initialItems], pageParams: [0] } }
      : {}),
  });
}

// VIP/VVIP strip data. A failure must never break the page: callers just get
// no data and render no strip (no retries piling up, no error UI).
export function useVipItems() {
  return useQuery({
    queryKey: ITEM_KEYS.vip(),
    queryFn: ({ signal }) => ItemService.getVipItems(50, undefined, { signal }),
    staleTime: 1000 * 30,
    retry: 1,
  });
}

// Hook for fetching the detailed data of a single item
// isSignedIn: undefined = auth not yet determined, false = not signed in, true = signed in
// initialData: server-side data (for SSR/SEO — Google sees it immediately)
export function useItemDetails(
  id: string,
  isSignedIn: boolean | undefined,
  getToken: (() => Promise<string | null>) | undefined,
  initialData?: Item | null,
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ITEM_KEYS.detail(id),
    queryFn: async () => {
      let supabaseClient: SupabaseClient | undefined;
      if (isSignedIn && getToken) {
        const { createClerkSupabaseClient } = await import("@/lib/supabase");
        supabaseClient = createClerkSupabaseClient(getToken);
      }
      return ItemService.getItemDetails(id, supabaseClient);
    },
    // Server-side data is shown immediately (SSR → Google sees it)
    initialData: initialData ?? undefined,
    initialDataUpdatedAt: initialData ? 0 : undefined, // 0 = stale, will refetch
    // Use cached data (Home, Profile, Saved) for an instant display until the query is ready
    placeholderData: initialData ? undefined : () => {
      const findItem = (data: unknown): Item | undefined => {
        if (!data || typeof data !== 'object') return undefined;
        const d = data as Record<string, unknown>;
        if (Array.isArray(d.pages)) {
          for (const page of d.pages) {
            if (Array.isArray(page)) {
              const found = page.find((i: Item) => i.id === id);
              if (found) return found as Item;
            }
          }
        }
        if (Array.isArray(data)) {
          return (data as Item[]).find((i) => i.id === id);
        }
        return undefined;
      };

      const allLists = queryClient.getQueriesData<unknown>({ queryKey: ITEM_KEYS.lists() });
      for (const [, list] of allLists) {
        const item = findItem(list);
        if (item) return item;
      }

      const userItems = queryClient.getQueriesData<unknown>({ queryKey: ITEM_KEYS.user() });
      for (const [, list] of userItems) {
        const item = findItem(list);
        if (item) return item;
      }

      const savedItems = queryClient.getQueriesData<unknown>({ queryKey: ITEM_KEYS.saved() });
      for (const [, list] of savedItems) {
        const item = findItem(list);
        if (item) return item;
      }

      return undefined;
    },
    // The query only runs once the auth state is determined.
    // If it ran sooner, the anon client wouldn't be able to see pending/rejected posts.
    enabled: !!id && isSignedIn !== undefined,
    staleTime: 1000 * 30,
    // Every time the detail page is opened, it always fetches fresh from
    // the server (not the stale cache) — moderation_status and images can
    // change between visits (item_images' RLS depends on moderation_status),
    // so a stale cache could show a wrong/empty image.
    refetchOnMount: "always",
  });
}

// Hook for fetching the user's own posts
export function useUserItems(userId?: string, getToken?: () => Promise<string | null>) {
  return useQuery({
    queryKey: ITEM_KEYS.userItems(userId || ""),
    queryFn: async () => {
      if (!userId || !getToken) return [];

      const { createClerkSupabaseClient } = await import("@/lib/supabase");
      const supabaseClient = createClerkSupabaseClient(getToken);

      return ItemService.getItems({ user_id: userId }, supabaseClient);
    },
    enabled: !!userId && !!getToken,
    staleTime: 1000 * 60 * 5, // 5 minute cache
    refetchOnWindowFocus: false,
    // The AI check on the server is async (takes a few seconds) — until it
    // finishes, the post stays "pending". Without this, the 5-minute
    // staleTime would leave the user with a stale "Under review" state until a manual reload.
    refetchInterval: (query) =>
      query.state.data?.some((item) => item.moderation_status === "pending")
        ? 3000
        : false,
  });
}

// Hook for fetching saved items (Saved)
export function useSavedItems(userId?: string, getToken?: () => Promise<string | null>) {
  return useQuery({
    queryKey: ITEM_KEYS.savedItems(userId || ""),
    queryFn: async () => {
      if (!userId || !getToken) return [];
      const { createClerkSupabaseClient } = await import("@/lib/supabase");
      const supabase = createClerkSupabaseClient(getToken);
      return ItemService.getSavedItems(supabase, userId);
    },
    enabled: !!userId && !!getToken,
    staleTime: 1000 * 60 * 5, // 5 minute cache
  });
}

export function useIsItemSaved(itemId: string, userId?: string, getToken?: () => Promise<string | null>) {
  const { data: savedItems = [] } = useSavedItems(userId, getToken);
  return (savedItems as Item[]).some((item) => item.id === itemId);
}
