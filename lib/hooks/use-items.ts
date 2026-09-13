/**
 * Хукҳои фармоишӣ барои кор бо эълонҳо (Items Hooks).
 * Ин файл аз React Query барои гирифтани маълумот, кэш ва навсозии автоматии рӯйхати ашёҳо истифода мебарад.
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
  saved: () => [...ITEM_KEYS.all, "saved"] as const,
  savedItems: (userId: string) => [...ITEM_KEYS.saved(), userId] as const,
};

const PAGE_SIZE = 20;
const MAX_PAGES = 10; // Ҳадди аксари саҳифаҳо дар хотира (200 ашё)

// initialItems — саҳифаи аввали натиҷа, ки дар сервер (Server Component)
// аллакай гирифта шудааст (ниг. app/(main)/page.tsx) — React Query онро
// ҳамчун "саҳифаи 0"-и кэш истифода мебарад, то HTML-и аввалия аллакай
// итемҳоро дошта бошад (барои Google/SEO), бе интизори fetch-и клиентӣ.
// Танҳо барои query-и БОИСТОДА (filters-и пешфарз, ки дар сервер гирифта
// шуда буд) амал мекунад — вақте ки корбар филтр иваз кунад, queryKey
// дигар мешавад ва fetch-и муқаррарии клиентӣ рӯй медиҳад.
export function useItems(filters?: ItemFilters, initialItems?: Item[]) {
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
    ...(initialItems
      ? { initialData: { pages: [initialItems], pageParams: [0] } }
      : {}),
  });
}

// Хук барои гирифтани маълумоти муфассали як ашё
// isSignedIn: undefined = auth ҳанӯз муайян нашудааст, false = вуруд накарда, true = вуруд кардааст
// initialData: маълумоти server-side (барои SSR/SEO — Google фавран мебинад)
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
    // Маълумоти server-side фавран нишон дода мешавад (SSR → Google мебинад)
    initialData: initialData ?? undefined,
    initialDataUpdatedAt: initialData ? 0 : undefined, // 0 = stale, refetch мешавад
    // Истифодаи маълумоти кэш (Home, Profile, Saved) барои намоиши лаҳзавӣ то query тайёр шавад
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
    // Фақат пас аз муайян шудани ҳолати auth query иҷро мешавад.
    // Агар зудтар иҷро шавад, anon client эълонҳои pending/rejected-ро дида наметавонад.
    enabled: !!id && isSignedIn !== undefined,
    staleTime: 1000 * 30,
    // Ҳар дафъае, ки саҳифаи муфассал кушода мешавад, ҳатман аз сервер нав
    // мегирад (на кэши куҳна) — moderation_status ва аксҳо метавонанд байни
    // боздидҳо тағир ёбанд (RLS-и item_images ба moderation_status вобаста
    // аст), пас кэши stale метавонад акси нодуруст/холӣ нишон диҳад.
    refetchOnMount: "always",
  });
}

// Хук барои гирифтани эълонҳои худи корбар
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
    staleTime: 1000 * 60 * 5, // 5 дақиқа кэш
    refetchOnWindowFocus: false,
    // Санҷиши AI дар сервер async аст (якчанд сония мегирад) — то он
    // тамом шавад, эълон "pending" мемонад. Бе ин, staleTime-и 5-дақиқагӣ
    // корбарро то reload-и дастӣ бо "Дар ҳоли санҷиш"-и кӯҳна мегузорад.
    refetchInterval: (query) =>
      query.state.data?.some((item) => item.moderation_status === "pending")
        ? 3000
        : false,
  });
}

// Хук барои гирифтани ашёҳои захирашуда (Saved)
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
    staleTime: 1000 * 60 * 5, // 5 дақиқа кэш
  });
}

export function useIsItemSaved(itemId: string, userId?: string, getToken?: () => Promise<string | null>) {
  const { data: savedItems = [] } = useSavedItems(userId, getToken);
  return (savedItems as Item[]).some((item) => item.id === itemId);
}
