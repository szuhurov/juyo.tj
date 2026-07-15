import { useQuery } from "@tanstack/react-query";
import { AdminService } from "@/lib/services/admin-service";

export interface DeletedNotificationEntry {
  id: string;
  user_id: string;
  kind: "verification" | "category_post";
  ref_id: string;
  item_id: string | null;
  item_title: string | null;
  related_name: string | null;
  related_avatar: string | null;
  status: string | null;
  deleted_at: string;
  deleter_name: string | null;
}

export function useDeletedNotificationsArchive() {
  return useQuery({
    queryKey: ["admin", "notifications", "deleted-archive"],
    queryFn: () =>
      AdminService.getDeletedNotificationsArchive() as Promise<{ entries: DeletedNotificationEntry[] }>,
    staleTime: 30_000,
  });
}
