import { useQuery } from "@tanstack/react-query";
import { Item, ItemService } from "@/lib/services/item-service";

export const ITEM_KEYS = {
  all: ["items"] as const,
  lists: () => [...ITEM_KEYS.all, "list"] as const,
  list: (filters: any) => [...ITEM_KEYS.lists(), { filters }] as const,
  details: () => [...ITEM_KEYS.all, "detail"] as const,
  detail: (id: string) => [...ITEM_KEYS.details(), id] as const,
  userItems: (userId: string) => [...ITEM_KEYS.all, "user", userId] as const,
  savedItems: (userId: string) => [...ITEM_KEYS.all, "saved", userId] as const,
  safetyItems: (userId: string) => [...ITEM_KEYS.all, "safety", userId] as const,
};

export function useItems(filters?: any) {
  return useQuery({
    queryKey: ITEM_KEYS.list(filters || {}),
    queryFn: () => ItemService.getItems(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useItemDetails(id: string) {
  return useQuery({
    queryKey: ITEM_KEYS.detail(id),
    queryFn: () => ItemService.getItemDetails(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 10, // 10 minutes for details
  });
}

export function useUserItems(userId?: string) {
  return useQuery({
    queryKey: ITEM_KEYS.userItems(userId || ""),
    queryFn: () => ItemService.getItems({ user_id: userId }),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSavedItems(userId?: string, token?: string) {
  return useQuery({
    queryKey: ITEM_KEYS.savedItems(userId || ""),
    queryFn: async () => {
      if (!userId || !token) return [];
      const { createClerkSupabaseClient } = await import("@/lib/supabase");
      const supabase = createClerkSupabaseClient(token);
      return ItemService.getSavedItems(supabase, userId);
    },
    enabled: !!userId && !!token,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSafetyItems(userId?: string, token?: string) {
  return useQuery({
    queryKey: ITEM_KEYS.safetyItems(userId || ""),
    queryFn: async () => {
      if (!userId || !token) return [];
      const { createClerkSupabaseClient } = await import("@/lib/supabase");
      const supabase = createClerkSupabaseClient(token);
      return ItemService.getSafetyBoxItems(supabase, userId);
    },
    enabled: !!userId && !!token,
    staleTime: 1000 * 60 * 5,
  });
}
