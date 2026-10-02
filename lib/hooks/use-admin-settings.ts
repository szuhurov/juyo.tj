import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminService } from "@/lib/services/admin-service";
import { ADMIN_KEYS } from "@/lib/hooks/admin-query-keys";

export interface AppSettings {
  id: boolean;
  /** Post lifetime in days (default 180). */
  post_lifetime_days: number;
  updated_at: string;
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ADMIN_KEYS.settings(),
    queryFn: () => AdminService.getSettings() as Promise<{ settings: AppSettings }>,
    staleTime: 30_000,
  });
}

export function useUpdateAdminSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: { post_lifetime_days?: number }) =>
      AdminService.updateSettings(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.settings() });
    },
  });
}
