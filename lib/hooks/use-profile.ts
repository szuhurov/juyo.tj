/**
 * Хук барои гирифтани профили корбари ҷорӣ бо кэши React Query — пеш аз
 * ин профил ҳар бор бо useEffect дастӣ fetch мешуд (бе кэш), яъне ҳар
 * гузариш ба /profile (масалан home → QR → бозгашт) skeleton-и навро
 * нишон медод, ҳатто агар чанд сония пеш аллакай fetch шуда буд.
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
    staleTime: 1000 * 60 * 2, // 2 дақиқа — телефон/QR статус хеле кам иваз мешавад
  });
}
