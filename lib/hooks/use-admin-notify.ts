import { useMutation } from "@tanstack/react-query";
import { AdminService } from "@/lib/services/admin-service";
import type { NotifyTarget } from "@/lib/services/admin-service";

export function useSendNotification() {
  return useMutation({
    mutationFn: (payload: { title: string; body: string; target: NotifyTarget }) =>
      AdminService.sendNotification(payload) as Promise<{ recipientCount: number; sent: number; failed: number }>,
  });
}
