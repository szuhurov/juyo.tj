import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Item, ItemService } from "@/lib/services/item-service";

export const ITEM_KEYS = {
  all: ["items"] as const,
  lists: () => [...ITEM_KEYS.all, "list"] as const,
  list: (filters: any) => [...ITEM_KEYS.lists(), { filters }] as const,
  details: () => [...ITEM_KEYS.all, "detail"] as const,
  detail: (id: string, token?: string) => [...ITEM_KEYS.details(), id, token].filter(Boolean) as const,
  userItems: (userId: string, token?: string) => [...ITEM_KEYS.all, "user", userId, token].filter(Boolean) as const,
  savedItems: (userId: string, token?: string) => [...ITEM_KEYS.all, "saved", userId, token].filter(Boolean) as const,
  safetyItems: (userId: string, token?: string) => [...ITEM_KEYS.all, "safety", userId, token].filter(Boolean) as const,
};

export function useItems(filters?: any) {
  return useQuery({
    queryKey: ITEM_KEYS.list(filters || {}),
    queryFn: () => ItemService.getItems(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: keepPreviousData,
  });
}

export function useItemDetails(id: string, token?: string) {
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
    enabled: !!id,
    staleTime: 0,
  });
}

export function useUserItems(userId?: string, token?: string) {
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
    staleTime: 0, // Always fetch fresh data for user's own items
    refetchOnWindowFocus: true,
  });
}

export function useSavedItems(userId?: string, token?: string) {
  return useQuery({
    queryKey: ITEM_KEYS.savedItems(userId || "", token),
    queryFn: async () => {
      if (!userId || !token) return [];
      const { createClerkSupabaseClient } = await import("@/lib/supabase");
      const supabase = createClerkSupabaseClient(token);
      return ItemService.getSavedItems(supabase, userId);
    },
    enabled: !!userId && !!token,
    staleTime: 0,
  });
}

export function useSafetyItems(userId?: string, token?: string) {
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
