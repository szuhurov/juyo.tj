/**
 * Hook for fetching the current user's profile with React Query caching —
 * previously the profile was manually fetched each time via useEffect
 * (with no cache), meaning every navigation to /profile (e.g. home → QR →
 * back) showed a new skeleton, even if it had already been fetched a few seconds earlier.
 */
import { useQuery } from "@tanstack/react-query";
import { ProfileService } from "@/lib/services/profile-service";
import { createClerkSupabaseClient } from "@/lib/supabase";

export const PROFILE_KEYS = {
  detail: (userId: string) => ["profile", "detail", userId] as const,
};

export function useProfileQuery(
  userId: string | null | undefined,
  getToken: (() => Promise<string | null>) | undefined,
) {
  return useQuery({
    queryKey: PROFILE_KEYS.detail(userId || ""),
    queryFn: () => {
      const supabase = createClerkSupabaseClient(getToken!);
      return ProfileService.getProfile(supabase, userId!);
    },
    enabled: !!userId && !!getToken,
    staleTime: 1000 * 60 * 2, // 2 minutes — phone/QR status changes very rarely
  });
}
