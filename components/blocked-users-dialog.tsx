"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { fetchBlockedUsers, unblockUser } from "@/lib/services/safety-service";

/** Profile → Settings → Blocked users, with unblock. Mirrors the mobile `app/blocked-users.tsx`. */
export function BlockedUsersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useLanguage();
  const { userId, getToken } = useAuth();
  const qc = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["blocked-users", userId],
    enabled: open && !!userId,
    queryFn: () => fetchBlockedUsers(createClerkSupabaseClient(getToken), userId!),
  });

  const onUnblock = async (id: string) => {
    if (!userId || pendingId) return;
    setPendingId(id);
    try {
      await unblockUser(createClerkSupabaseClient(getToken), userId, id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["blocked-users", userId] }),
        qc.invalidateQueries({ queryKey: ["blocked-ids", userId] }),
      ]);
      toast.success(t("userUnblocked"));
    } catch {
      toast.error(t("error"));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-md border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle>{t("blockedUsersTitle")}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-rose-500">{t("error")}</p>
        ) : data.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">{t("noBlockedUsers")}</p>
        ) : (
          <ul className="space-y-3">
            {data.map((u) => (
              <li key={u.id} className="flex items-center gap-3 min-h-12">
                {u.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                    <User className="w-4 h-4 text-zinc-500" />
                  </span>
                )}
                <span className="flex-1 truncate text-sm font-semibold text-zinc-900 dark:text-white">
                  {u.name || t("unknownUser")}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!pendingId}
                  onClick={() => onUnblock(u.id)}
                  aria-label={`${t("unblock")}: ${u.name || t("unknownUser")}`}
                  className="h-9 min-w-24 rounded-md"
                >
                  {pendingId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t("unblock")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
