"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { fetchBlockedIds } from "@/lib/services/safety-service";

const EMPTY = new Set<string>();

/**
 * Users the signed-in user blocked — their listings are hidden from this
 * user's feed and listing pages (client-side preference; RLS keeps the list
 * private). Same query key as the mobile app's hook.
 */
export function useBlockedIds(): Set<string> {
  const { userId, getToken } = useAuth();
  const { data } = useQuery({
    queryKey: ["blocked-ids", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: () => fetchBlockedIds(createClerkSupabaseClient(getToken), userId!),
  });
  return userId ? (data ?? EMPTY) : EMPTY;
}
