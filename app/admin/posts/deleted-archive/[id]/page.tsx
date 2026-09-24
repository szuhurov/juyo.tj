"use client";

import { use } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { Archive, Package, Eye } from "lucide-react";
import { useDeletedItemEntry } from "@/lib/hooks/use-admin-posts";
import { StatusPill } from "@/components/admin/status-pill";
import { Skeleton } from "@/components/ui/skeleton";

export default function DeletedPostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useDeletedItemEntry(id);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-md" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm font-semibold text-red-600 dark:text-red-400">Сабт ёфт нашуд</p>;
  }

  const s = data.entry.item_snapshot;
  const ownerName = `${s.profiles?.first_name ?? ""} ${s.profiles?.last_name ?? ""}`.trim() || "—";

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <StatusPill status={s.type} />
            <StatusPill status={s.moderation_status} />
            {s.is_resolved && <StatusPill status="resolved" />}
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-medium">
            <Archive className="w-4 h-4" />
            Пурра нест шуд: {format(new Date(data.entry.deleted_at), "d MMM yyyy, HH:mm")}
          </div>
        </div>

        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{s.title}</h1>
        </div>

        {s.images?.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {s.images.map((img) => (
              <div
                key={img.image_url}
                className="relative w-24 h-24 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0"
              >
                <Image src={img.image_url} alt={s.title} fill sizes="96px" className="object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <span className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> {s.category}
          </span>
          <span className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> Соҳиб: {ownerName}
          </span>
          <span>Сохта шуда буд: {format(new Date(s.created_at), "d MMM yyyy")}</span>
        </div>
      </div>

      <p className="text-xs font-medium text-zinc-400">
        Ин snapshot-и эълон пеш аз пурра нест кардани он аст — дигар дар система вуҷуд надорад.
      </p>
    </div>
  );
}
