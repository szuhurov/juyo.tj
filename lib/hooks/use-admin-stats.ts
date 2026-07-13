import { useQuery } from "@tanstack/react-query";
import { AdminService } from "@/lib/services/admin-service";
import { ADMIN_KEYS } from "@/lib/hooks/admin-query-keys";

export type StatsPeriod = "today" | "week" | "month" | "year" | "all";

export interface AdminStats {
  period: StatsPeriod;
  totalUsers: number;
  usersJoinedToday: number;
  usersJoinedThisMonth: number;
  totalLostItems: number;
  totalFoundItems: number;
  totalResolvedItems: number;
  pendingModerationCount: number;
  totalPushEnabledUsers: number;
  signupsByDay: { date: string; count: number }[];
  signupsGranularity: "hour" | "day" | "month";
  itemsByCategory: { category: string; count: number }[];
}

export function useAdminStats(period?: StatsPeriod) {
  return useQuery({
    queryKey: [...ADMIN_KEYS.stats(), period ?? "all"],
    queryFn: () => AdminService.getStats(period) as Promise<AdminStats>,
    staleTime: 60_000,
  });
}
