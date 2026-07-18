"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StatusPill } from "@/components/admin/status-pill";
import { VerifiedBadge } from "@/components/verified-badge";
import type { AdminUserRow } from "@/lib/hooks/use-admin-users";

const GRID_COLS = "70px minmax(140px,1.3fr) minmax(140px,1.3fr) minmax(110px,1fr) minmax(110px,0.9fr) minmax(90px,0.8fr) minmax(90px,0.8fr) 50px";

export function UserTable({ rows }: { rows: AdminUserRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm font-bold text-zinc-400">Ягон корбар ёфт нашуд</p>;
  }

  const copyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    toast.success("ID нусхабардорӣ шуд");
  };

  return (
    <div className="rounded-xl border border-zinc-100 shadow-sm overflow-x-auto">
      <div className="min-w-[800px]">
      <div
        className="grid gap-5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100"
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        <span>Id</span>
        <span>Ном</span>
        <span>Почта</span>
        <span>Тамос</span>
        <span>Сана</span>
        <span>Эълонҳо</span>
        <span>Ҳолат</span>
        <span />
      </div>

      <div className="divide-y divide-zinc-50 p-1.5 space-y-1">
        {rows.map((user) => {
          const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Беном";
          return (
            <div
              key={user.id}
              className="group grid gap-5 items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-blue-600 hover:shadow-[0_4px_16px_-4px_rgba(37,99,235,0.4)] transition-all"
              style={{ gridTemplateColumns: GRID_COLS }}
              onClick={() => router.push(`/admin/users/${user.id}`)}
            >
              <span
                className="text-zinc-400 font-bold group-hover:text-blue-100 hover:underline"
                onClick={(e) => copyId(e, user.id)}
                title="Клик — нусхабардории ID пурра"
              >
                #{user.id.slice(-4)}
              </span>

              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="w-9 h-9 border border-zinc-100 group-hover:border-white/30 shrink-0">
                  <AvatarImage src={user.avatar_url ?? undefined} alt={name} />
                  <AvatarFallback className="bg-blue-50 text-blue-600 text-xs font-bold">
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="font-bold text-zinc-800 group-hover:text-white truncate min-w-0 flex items-center gap-1">
                  <span className="truncate">{name}</span>
                  {user.is_verified && <VerifiedBadge className="group-hover:stroke-blue-600" />}
                </p>
              </div>

              <span className="text-zinc-500 group-hover:text-blue-100 font-medium truncate">
                {user.email ?? "—"}
              </span>

              <span className="text-zinc-500 group-hover:text-blue-100 font-medium truncate">
                {user.phone ?? "—"}
              </span>

              <span className="text-zinc-500 group-hover:text-blue-100 font-medium">
                {format(new Date(user.created_at), "d MMM yyyy")}
              </span>

              <span className="text-zinc-500 group-hover:text-blue-100 font-medium">
                {user.itemsCount}
                {user.resolvedCount > 0 && (
                  <span className="text-emerald-600 group-hover:text-emerald-200 font-bold"> ({user.resolvedCount} ҳалшуда)</span>
                )}
              </span>

              <StatusPill status={user.status ?? "active"} variant="dot" />

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/admin/users/${user.id}`);
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
