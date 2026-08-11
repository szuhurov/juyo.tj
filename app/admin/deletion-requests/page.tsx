"use client";

import { useState } from "react";
import { UserX as UserXIcon, CheckCircle2 as CheckIcon, XCircle as XIcon } from "lucide-react";
import { useAdminDeletionRequests, useUpdateDeletionRequest } from "@/lib/hooks/use-admin-deletion-requests";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { id: "pending", label: "Дар интизор" },
  { id: "processed", label: "Коркард шуда" },
  { id: "rejected", label: "Радшуда" },
  { id: "all", label: "Ҳама" },
] as const;

export default function AdminDeletionRequestsPage() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["id"]>("pending");
  const { data, isLoading, isError } = useAdminDeletionRequests(status);
  const updateRequest = useUpdateDeletionRequest();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UserXIcon className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 text-rose-500 dark:text-rose-400" />
        <h1 className="text-lg min-[1084px]:text-xl font-bold text-zinc-900 dark:text-white">Дархостҳои нест кардани ҳисоб</h1>
      </div>

      <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-4 space-y-4">
        <div className="flex bg-zinc-100/60 p-0.5 rounded-lg border border-zinc-200/50 w-fit">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatus(tab.id)}
              className={cn(
                "px-4 min-[1084px]:px-5 h-9 min-[1084px]:h-10 rounded-lg font-bold text-[11px] min-[1084px]:text-xs tracking-wider transition-all",
                status === tab.id
                  ? "bg-emerald-500 text-white"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isError ? (
          <p className="py-16 text-center text-sm font-bold text-rose-500 dark:text-rose-400">Хатогӣ ҳангоми боркунӣ</p>
        ) : isLoading || !data ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : data.requests.length === 0 ? (
          <p className="py-16 text-center text-sm font-bold text-zinc-400">Ягон дархост нест</p>
        ) : (
          <div className="space-y-2">
            {data.requests.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-bold text-sm min-[1084px]:text-base text-zinc-900 dark:text-white">{r.email}</p>
                  <p className="text-xs min-[1084px]:text-[13px] text-zinc-500 dark:text-zinc-400">
                    {new Date(r.created_at).toLocaleDateString("tg-TJ")}
                  </p>
                  {r.note && (
                    <p className="text-xs min-[1084px]:text-[13px] text-zinc-600 dark:text-zinc-300 italic max-w-xl">&ldquo;{r.note}&rdquo;</p>
                  )}
                </div>
                {r.status === "pending" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateRequest.isPending}
                      onClick={() => updateRequest.mutate({ id: r.id, status: "rejected" })}
                      className="h-9 min-[1084px]:h-10 rounded-lg font-bold text-[9px] min-[1084px]:text-[10px] tracking-widest gap-1.5"
                    >
                      <XIcon className="w-3.5 h-3.5 min-[1084px]:w-4 min-[1084px]:h-4" />
                      Радд
                    </Button>
                    <Button
                      size="sm"
                      disabled={updateRequest.isPending}
                      onClick={() => {
                        if (window.confirm(`Ҳисоби бо email "${r.email}" пурра нест карда мешавад. Мутмаин ҳастед?`)) {
                          updateRequest.mutate({ id: r.id, status: "processed" });
                        }
                      }}
                      className="h-9 min-[1084px]:h-10 rounded-lg font-bold text-[9px] min-[1084px]:text-[10px] tracking-widest gap-1.5 bg-emerald-500 hover:bg-emerald-600"
                    >
                      <CheckIcon className="w-3.5 h-3.5 min-[1084px]:w-4 min-[1084px]:h-4" />
                      Тасдиқ ва нест кардан
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
