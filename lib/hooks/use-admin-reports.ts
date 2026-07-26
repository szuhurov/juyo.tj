import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminService } from "@/lib/services/admin-service";
import { ADMIN_KEYS } from "@/lib/hooks/admin-query-keys";

export interface AdminReportRow {
  id: string;
  item_id: string;
  reporter_id: string;
  reason: "spam" | "inappropriate" | "fake" | "offensive" | "other";
  details: string | null;
  status: "pending" | "reviewed" | "dismissed";
  created_at: string;
  items: { title: string; moderation_status: string } | null;
  reporter: { first_name: string | null; last_name: string | null } | null;
}

// Шумораи шикоятҳои "дар интизор" — барои badge-и sidebar, мисли usePendingPostsCount.
export function usePendingReportsCount() {
  return useQuery({
    queryKey: [...ADMIN_KEYS.reportsList("pending"), "count"],
    queryFn: async () => {
      const res = (await AdminService.getReports({ status: "pending" })) as { reports: AdminReportRow[] };
      return res.reports.length;
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export function useAdminReports(status: string) {
  return useQuery({
    queryKey: ADMIN_KEYS.reportsList(status),
    queryFn: () => AdminService.getReports({ status }) as Promise<{ reports: AdminReportRow[] }>,
    staleTime: 15_000,
  });
}

export function useUpdateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "reviewed" | "dismissed" }) =>
      AdminService.updateReport(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.reports() });
    },
  });
}
