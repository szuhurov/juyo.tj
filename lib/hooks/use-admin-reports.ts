import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminService } from "@/lib/services/admin-service";
import { ADMIN_KEYS } from "@/lib/hooks/admin-query-keys";

export interface AdminReportRow {
  id: string;
  reporter_id: string;
  item_id: string | null;
  reported_user_id: string | null;
  reason: "spam" | "scam" | "offensive" | "personal_info" | "fake" | "other";
  details: string | null;
  status: "open" | "resolved" | "dismissed";
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter_name: string | null;
  reported_user_name: string | null;
  item_title: string | null;
  item_status: string | null;
  item_image: string | null;
}

export function useOpenReportsCount() {
  return useQuery({
    queryKey: [...ADMIN_KEYS.reportsList("open"), "count"],
    queryFn: async () => {
      const res = (await AdminService.getReports({ status: "open" })) as { reports: AdminReportRow[] };
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
    mutationFn: ({ id, action }: { id: string; action: "remove_item" | "keep_item" | "dismiss" }) =>
      AdminService.updateReport(id, { action }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.reports() });
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.posts() });
    },
  });
}
