/**
 * Хукҳои фармоишӣ барои кор бо эълонҳо (Items Hooks).
 * Ин файл аз React Query барои гирифтани маълумот, кэш ва навсозии автоматии рӯйхати ашёҳо истифода мебарад.
 */

import { useQuery, keepPreviousData, useQueryClient, useInfiniteQuery } from "@tanstack/react-query"; // Барои идоракунии кэш ва запросҳо
import { Item, ItemService } from "@/lib/services/item-service"; // Барои кор бо эълонҳо

// Калидҳо барои React Query, то ки кэш дуруст идора карда шавад
export const ITEM_KEYS = {
  all: ["items"] as const,
  lists: () => [...ITEM_KEYS.all, "list"] as const,
  list: (filters: any) => [...ITEM_KEYS.lists(), { filters }] as const,
  details: () => [...ITEM_KEYS.all, "detail"] as const,
  detail: (id: string) => [...ITEM_KEYS.details(), id] as const,
  user: () => [...ITEM_KEYS.all, "user"] as const,
  userItems: (userId: string) => [...ITEM_KEYS.user(), userId] as const,
  saved: () => [...ITEM_KEYS.all, "saved"] as const,
  savedItems: (userId: string) => [...ITEM_KEYS.saved(), userId] as const,
  safety: () => [...ITEM_KEYS.all, "safety"] as const,
  safetyItems: (userId: string) => [...ITEM_KEYS.safety(), userId] as const,
};

const PAGE_SIZE = 20;
const MAX_PAGES = 10; // Ҳадди аксари саҳифаҳо дар хотира (200 ашё)

export function useItems(filters?: any) {
  return useInfiniteQuery({
    queryKey: ITEM_KEYS.list(filters || {}),
    queryFn: ({ pageParam = 0 }) =>
      ItemService.getItems({ ...filters, page: pageParam, pageSize: PAGE_SIZE }),
    getNextPageParam: (lastPage, allPages) => {
      if (allPages.length >= MAX_PAGES) return undefined;
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5,
    maxPages: MAX_PAGES,
  });
}

// Хук барои гирифтани маълумоти муфассали як ашё
// token: undefined = auth ҳанӯз муайян нашудааст, null = вуруд накарда, string = вуруд кардааст
// initialData: маълумоти server-side (барои SSR/SEO — Google фавран мебинад)
export function useItemDetails(id: string, token: string | null | undefined, initialData?: Item | null) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ITEM_KEYS.detail(id),
    queryFn: async () => {
      let supabaseClient = null;
      if (token) {
        const { createClerkSupabaseClient } = await import("@/lib/supabase");
        supabaseClient = createClerkSupabaseClient(token);
      }
      return ItemService.getItemDetails(id, supabaseClient);
    },
    // Маълумоти server-side фавран нишон дода мешавад (SSR → Google мебинад)
    initialData: initialData ?? undefined,
    initialDataUpdatedAt: initialData ? 0 : undefined, // 0 = stale, refetch мешавад
    // Истифодаи маълумоти кэш (Home, Profile, Saved) барои намоиши лаҳзавӣ то query тайёр шавад
    placeholderData: initialData ? undefined : () => {
      const findItem = (data: any) => {
        if (!data) return undefined;
        if (data.pages && Array.isArray(data.pages)) {
          for (const page of data.pages) {
            if (Array.isArray(page)) {
              const item = page.find((i: Item) => i.id === id);
              if (item) return item;
            }
          }
        }
        if (Array.isArray(data)) {
          return data.find((i: Item) => i.id === id);
        }
        return undefined;
      };

      const allLists = queryClient.getQueriesData<any>({ queryKey: ITEM_KEYS.lists() });
      for (const [_, list] of allLists) {
        const item = findItem(list);
        if (item) return item;
      }

      const userItems = queryClient.getQueriesData<any>({ queryKey: ITEM_KEYS.user() });
      for (const [_, list] of userItems) {
        const item = findItem(list);
        if (item) return item;
      }

      const savedItems = queryClient.getQueriesData<any>({ queryKey: ITEM_KEYS.saved() });
      for (const [_, list] of savedItems) {
        const item = findItem(list);
        if (item) return item;
      }

      return undefined;
    },
    // Фақат пас аз муайян шудани ҳолати auth query иҷро мешавад.
    // Агар зудтар иҷро шавад, anon client эълонҳои pending/rejected-ро дида наметавонад.
    enabled: !!id && token !== undefined,
    staleTime: 1000 * 30,
  });
}

// Хук барои гирифтани эълонҳои худи корбар
export function useUserItems(userId?: string, token?: string | null) {
  return useQuery({
    queryKey: ITEM_KEYS.userItems(userId || ""),
    queryFn: async () => {
      if (!userId || !token) return [];
      
      const { createClerkSupabaseClient } = await import("@/lib/supabase");
      const supabaseClient = createClerkSupabaseClient(token);
      
      return ItemService.getItems({ user_id: userId }, supabaseClient);
    },
    enabled: !!userId && !!token,
    staleTime: 1000 * 60 * 5, // 5 дақиқа кэш
    refetchOnWindowFocus: false,
  });
}

// Хук барои гирифтани ашёҳои захирашуда (Saved)
export function useSavedItems(userId?: string, token?: string | null) {
  return useQuery({
    queryKey: ITEM_KEYS.savedItems(userId || ""),
    queryFn: async () => {
      if (!userId || !token) return [];
      const { createClerkSupabaseClient } = await import("@/lib/supabase");
      const supabase = createClerkSupabaseClient(token);
      return ItemService.getSavedItems(supabase, userId);
    },
    enabled: !!userId && !!token,
    staleTime: 1000 * 60 * 5, // 5 дақиқа кэш
  });
}

export function useIsItemSaved(itemId: string, userId?: string, token?: string | null) {
  const { data: savedItems = [] } = useSavedItems(userId, token);
  return savedItems.some((item: any) => item.id === itemId);
}

// Хук барои гирифтани ашёҳо аз сандуқчаи амниятӣ (Safety Box)
export function useSafetyItems(userId?: string, token?: string | null) {
  return useQuery({
    queryKey: ITEM_KEYS.safetyItems(userId || ""),
    queryFn: async () => {
      if (!userId || !token) return [];
      const { createClerkSupabaseClient } = await import("@/lib/supabase");
      const supabase = createClerkSupabaseClient(token);
      return ItemService.getSafetyBoxItems(supabase, userId);
    },
    enabled: !!userId && !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

// Хук барои гирифтани маълумоти муфассали як ашё аз Safety Box
export function useSafetyItemDetails(id: string, token?: string | null) {
  return useQuery({
    queryKey: ITEM_KEYS.detail(id), // Мо калиди detail-ро истифода мебарем барои кэш
    queryFn: async () => {
      if (!token) return null;
      const { createClerkSupabaseClient } = await import("@/lib/supabase");
      const supabaseClient = createClerkSupabaseClient(token);
      return ItemService.getSafetyItemDetails(id, supabaseClient);
    },
    enabled: !!id && !!token,
    staleTime: 1000 * 60,
  });
}
