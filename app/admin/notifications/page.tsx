"use client";

import { format } from "date-fns";
import { Bell, Tag, User } from "lucide-react";
import { useDeletedNotificationsArchive } from "@/lib/hooks/use-admin-notifications";
import { StatusPill } from "@/components/admin/status-pill";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminNotificationsPage() {
  const { data, isLoading, isError, error } = useDeletedNotificationsArchive();
  const entries = data?.entries ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-black text-zinc-700">
            Огоҳиномаҳои нестшуда аз ҷониби корбарон
          </h2>
        </div>

        {isError ? (
          <p className="py-16 text-center text-sm font-bold text-rose-500">
            Хатогӣ ҳангоми боркунӣ: {error instanceof Error ? error.message : "номаълум"}
          </p>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-16 text-center text-sm font-bold text-zinc-400">
            Ҳоло ягон огоҳинома нест карда нашудааст
          </p>
        ) : (
          <div className="rounded-xl border border-zinc-100 overflow-hidden">
            <div className="divide-y divide-zinc-50 p-1.5 space-y-1">
              {entries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-zinc-100 overflow-hidden shrink-0 flex items-center justify-center">
                      {e.related_avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.related_avatar} alt="" className="w-full h-full object-cover" />
                      ) : e.kind === "category_post" ? (
                        <Tag className="w-4 h-4 text-zinc-300" />
                      ) : (
                        <User className="w-4 h-4 text-zinc-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-800 truncate">
                        {e.item_title ?? "—"}
                      </p>
                      <p className="text-[11px] font-medium text-zinc-400 truncate">
                        {e.kind === "category_post" ? "Эълони категория" : "Санҷиши моликият"}
                        {e.related_name ? ` · ${e.related_name}` : ""}
                        {" · нестшуда аз тарафи "}
                        {e.deleter_name || e.user_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-medium text-zinc-400 whitespace-nowrap">
                      {format(new Date(e.deleted_at), "d MMM yyyy, HH:mm")}
                    </span>
                    {e.status && <StatusPill status={e.status} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
