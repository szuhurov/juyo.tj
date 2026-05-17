/**
 * Хукҳои фармоишӣ барои кор бо эълонҳо (Items Hooks).
 * Ин файл аз React Query барои гирифтани маълумот, кэш ва навсозии автоматии рӯйхати ашёҳо истифода мебарад.
 */

import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query"; // Барои идоракунии кэш ва запросҳо
import { Item, ItemService } from "@/lib/services/item-service"; // Барои кор бо эълонҳо

// Калидҳо барои React Query, то ки кэш дуруст идора карда шавад
export const ITEM_KEYS = {
  all: ["items"] as const,
  lists: () => [...ITEM_KEYS.all, "list"] as const,
  list: (filters: any) => [...ITEM_KEYS.lists(), { filters }] as const,
  details: () => [...ITEM_KEYS.all, "detail"] as const,
  detail: (id: string, token?: string | null) => [...ITEM_KEYS.details(), id, token].filter(Boolean),
  userItems: (userId: string, token?: string | null) => [...ITEM_KEYS.all, "user", userId, token].filter(Boolean),
  savedItems: (userId: string, token?: string | null) => [...ITEM_KEYS.all, "saved", userId, token].filter(Boolean),
  safetyItems: (userId: string, token?: string | null) => [...ITEM_KEYS.all, "safety", userId, token].filter(Boolean),
};

// Хук барои гирифтани рӯйхати умумии ашёҳо бо филтрҳо
export function useItems(filters?: any) {
  return useQuery({
    queryKey: ITEM_KEYS.list(filters || {}),
    queryFn: () => ItemService.getItems(filters),
    staleTime: 1000 * 60 * 5, // 5 дақиқа нигоҳ доштани маълумот дар кэш
    placeholderData: keepPreviousData,
  });
}

// Хук барои гирифтани маълумоти муфассали як ашё
export function useItemDetails(id: string, token?: string | null) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ITEM_KEYS.detail(id, token),
    queryFn: async () => {
      let supabaseClient = null;
      if (token) {
        const { createClerkSupabaseClient } = await import("@/lib/supabase");
        supabaseClient = createClerkSupabaseClient(token);
      }
      return ItemService.getItemDetails(id, supabaseClient);
    },
    // Усули "Pro": Истифодаи маълумот аз ҳамаи кэшҳо (Home, Profile, Saved) барои боршавии лаҳзавӣ
    placeholderData: () => {
      // 1. Ҷустуҷӯ дар рӯйхатҳои умумӣ (Home)
      const allLists = queryClient.getQueriesData<Item[]>({ queryKey: ITEM_KEYS.lists() });
      for (const [_, list] of allLists) {
        const item = list?.find((i) => i.id === id);
        if (item) return item;
      }

      // 2. Ҷустуҷӯ дар эълонҳои худи корбар (My Posts)
      const userItems = queryClient.getQueriesData<Item[]>({ queryKey: ["items", "user"] });
      for (const [_, list] of userItems) {
        const item = list?.find((i) => i.id === id);
        if (item) return item;
      }

      // 3. Ҷустуҷӯ дар эълонҳои захирашуда (Saved)
      const savedItems = queryClient.getQueriesData<Item[]>({ queryKey: ["items", "saved"] });
      for (const [_, list] of savedItems) {
        const item = list?.find((i) => i.id === id);
        if (item) return item;
      }

      return undefined;
    },
    enabled: !!id,
    staleTime: 1000 * 30, // 30 сония маълумоти кэшшуда "тоза" ҳисоб мешавад
  });
}

// Хук барои гирифтани эълонҳои худи корбар
export function useUserItems(userId?: string, token?: string | null) {
  return useQuery({
    queryKey: ITEM_KEYS.userItems(userId || "", token),
    queryFn: async () => {
      if (!userId) return [];
      
      let supabaseClient = null;
      if (token) {
        const { createClerkSupabaseClient } = await import("@/lib/supabase");
        supabaseClient = createClerkSupabaseClient(token);
      }
      
      return ItemService.getItems({ user_id: userId }, supabaseClient);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 дақиқа кэш
    refetchOnWindowFocus: false,
  });
}

// Хук барои гирифтани ашёҳои захирашуда (Saved)
export function useSavedItems(userId?: string, token?: string | null) {
  return useQuery({
    queryKey: ITEM_KEYS.savedItems(userId || "", token),
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

/**
 * Хук барои санҷидани он ки оё ашё захира шудааст.
 * Ин хук аз кэши useSavedItems истифода мебарад ва дархости зиёдатӣ намекунад.
 */
export function useIsItemSaved(itemId: string, userId?: string) {
  const { data: savedItems = [] } = useSavedItems(userId);
  return savedItems.some((item: any) => item.id === itemId);
}

// Хук барои гирифтани ашёҳо аз сандуқчаи амниятӣ (Safety Box)
export function useSafetyItems(userId?: string, token?: string | null) {
  return useQuery({
    queryKey: ITEM_KEYS.safetyItems(userId || "", token),
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
