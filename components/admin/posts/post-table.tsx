"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import { Package, Settings } from "lucide-react";
import { StatusPill } from "@/components/admin/status-pill";
import type { AdminPostRow } from "@/lib/hooks/use-admin-posts";

const GRID_COLS =
  "70px minmax(200px,1.6fr) minmax(120px,1fr) minmax(90px,0.7fr) minmax(110px,0.8fr) minmax(120px,0.9fr) 50px";

export function PostTable({ rows }: { rows: AdminPostRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm font-bold text-zinc-400">Ягон эълон ёфт нашуд</p>;
  }

  return (
    <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-x-auto">
      <div className="min-w-[760px]">
      <div
        className="grid gap-5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800"
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        <span>Id</span>
        <span>Эълон</span>
        <span>Соҳиб</span>
        <span>Намуд</span>
        <span>Сана</span>
        <span>Ҳолат</span>
        <span />
      </div>

      <div className="divide-y divide-zinc-50 p-1.5 space-y-1">
        {rows.map((post) => {
          const ownerName = `${post.profiles?.first_name ?? ""} ${post.profiles?.last_name ?? ""}`.trim() || "—";
          const thumb = post.images?.[0]?.image_url;
          return (
            <div
              key={post.id}
              className="group grid gap-5 items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-blue-600 transition-all"
              style={{ gridTemplateColumns: GRID_COLS }}
              onClick={() => router.push(`/admin/posts/${post.id}`)}
            >
              <span className="text-zinc-400 font-bold group-hover:text-blue-100">#{post.id.slice(-4)}</span>

              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {thumb ? (
                    <Image src={thumb} alt={post.title} width={40} height={40} className="object-cover w-full h-full" />
                  ) : (
                    <Package className="w-4 h-4 text-zinc-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-white truncate">{post.title}</p>
                  <p className="text-[11px] font-medium text-zinc-400 group-hover:text-blue-100 truncate">{post.category}</p>
                </div>
              </div>

              <span className="text-zinc-500 dark:text-zinc-400 group-hover:text-blue-100 font-medium truncate">{ownerName}</span>

              <StatusPill status={post.type} />

              <span className="text-zinc-500 dark:text-zinc-400 group-hover:text-blue-100 font-medium whitespace-nowrap">
                {format(new Date(post.created_at), "d MMM yyyy")}
              </span>

              <div className="flex items-center gap-1.5">
                {post.status === "deleted" ? (
                  <StatusPill status="deleted" variant="dot" />
                ) : (
                  <StatusPill status={post.moderation_status} variant="dot" />
                )}
                {post.is_resolved && <StatusPill status="resolved" variant="dot" />}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/admin/posts/${post.id}`);
                }}
                className="flex items-center justify-center w-7 h-7 rounded-full text-zinc-400 group-hover:text-white hover:bg-white/20 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
