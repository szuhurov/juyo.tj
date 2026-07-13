"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import { Package } from "lucide-react";
import { useAdminPosts } from "@/lib/hooks/use-admin-posts";
import { useDeletedItemsArchive } from "@/lib/hooks/use-admin-posts";
import { StatusPill } from "@/components/admin/status-pill";

interface CombinedRow {
  key: string;
  href: string;
  title: string;
  subtitle: string;
  thumb?: string;
  date: string;
  kind: "trash" | "purged";
}

export function DeletedPostsArchive() {
  const router = useRouter();
  const { data: trashData, isLoading: trashLoading } = useAdminPosts({ status: "deleted", page: 0, pageSize: 200 });
  const { data: archiveData, isLoading: archiveLoading } = useDeletedItemsArchive();

  if (trashLoading || archiveLoading) {
    return <p className="py-16 text-center text-sm font-bold text-zinc-400">Боркунӣ...</p>;
  }

  const trashRows: CombinedRow[] = (trashData?.posts ?? []).map((post) => ({
    key: `trash-${post.id}`,
    href: `/admin/posts/${post.id}`,
    title: post.title,
    subtitle: `${post.category} · ${`${post.profiles?.first_name ?? ""} ${post.profiles?.last_name ?? ""}`.trim() || "—"}`,
    thumb: post.images?.[0]?.image_url,
    date: post.created_at,
    kind: "trash",
  }));

  const purgedRows: CombinedRow[] = (archiveData?.entries ?? []).map((entry) => {
    const s = entry.item_snapshot;
    return {
      key: `purged-${entry.id}`,
      href: `/admin/posts/deleted-archive/${entry.id}`,
      title: s.title,
      subtitle: `${s.category} · ${`${s.profiles?.first_name ?? ""} ${s.profiles?.last_name ?? ""}`.trim() || "—"}`,
      thumb: s.images?.[0]?.image_url,
      date: entry.deleted_at,
      kind: "purged",
    };
  });

  const rows = [...trashRows, ...purgedRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm font-bold text-zinc-400">Ягон эълони нестшуда нест</p>;
  }

  return (
    <div className="rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
      <div className="divide-y divide-zinc-50 p-1.5 space-y-1">
        {rows.map((row) => (
          <div
            key={row.key}
            onClick={() => router.push(row.href)}
            className="group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-blue-600 hover:shadow-[0_4px_16px_-4px_rgba(37,99,235,0.4)] transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 overflow-hidden shrink-0 flex items-center justify-center">
                {row.thumb ? (
                  <Image src={row.thumb} alt={row.title} width={40} height={40} className="object-cover w-full h-full" />
                ) : (
                  <Package className="w-4 h-4 text-zinc-300" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-zinc-800 group-hover:text-white truncate">{row.title}</p>
                <p className="text-[11px] font-medium text-zinc-400 group-hover:text-blue-100 truncate">{row.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[11px] font-medium text-zinc-400 group-hover:text-blue-100 whitespace-nowrap">
                {format(new Date(row.date), "d MMM yyyy, HH:mm")}
              </span>
              {row.kind === "trash" ? (
                <StatusPill status="deleted" label="Trash" />
              ) : (
                <StatusPill status="purged" label="Пурра" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
