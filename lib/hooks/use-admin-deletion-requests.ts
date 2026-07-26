import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminService } from "@/lib/services/admin-service";
import { ADMIN_KEYS } from "@/lib/hooks/admin-query-keys";

export interface AdminDeletionRequestRow {
  id: string;
  email: string;
  note: string | null;
  status: "pending" | "processed" | "rejected";
  created_at: string;
  processed_at: string | null;
}

export function usePendingDeletionRequestsCount() {
  return useQuery({
    queryKey: [...ADMIN_KEYS.deletionRequestsList("pending"), "count"],
    queryFn: async () => {
      const res = (await AdminService.getDeletionRequests({ status: "pending" })) as { requests: AdminDeletionRequestRow[] };
      return res.requests.length;
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export function useAdminDeletionRequests(status: string) {
  return useQuery({
    queryKey: ADMIN_KEYS.deletionRequestsList(status),
    queryFn: () => AdminService.getDeletionRequests({ status }) as Promise<{ requests: AdminDeletionRequestRow[] }>,
    staleTime: 15_000,
  });
}

export function useUpdateDeletionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "processed" | "rejected" }) =>
      AdminService.updateDeletionRequest(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.deletionRequests() });
    },
  });
}
