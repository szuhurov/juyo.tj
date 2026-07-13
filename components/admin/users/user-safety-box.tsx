"use client";

import { format } from "date-fns";
import { Archive } from "lucide-react";
import { StatusPill } from "@/components/admin/status-pill";
import type { AdminUserDetail } from "@/lib/hooks/use-admin-users";

const GRID_COLS = "70px minmax(200px,2fr) minmax(90px,0.8fr) minmax(130px,1fr) minmax(110px,0.9fr)";

export function UserSafetyBox({ items }: { items: AdminUserDetail["safetyBoxItems"] }) {
  if (items.length === 0) {
    return <p className="py-16 text-center text-sm font-bold text-zinc-400">Сандуқча холӣ аст</p>;
  }

  return (
    <div className="rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
      <div
        className="grid gap-5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100"
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        <span>Id</span>
        <span>Ашё</span>
        <span>Намуд</span>
        <span>Мукофот</span>
        <span>Сана</span>
      </div>

      <div className="divide-y divide-zinc-50 p-1.5 space-y-1">
        {items.map((box) => {
          const thumb = box.images?.[0];
          return (
            <div
              key={box.id}
              className="grid gap-5 items-center px-3 py-2.5 rounded-lg"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <span className="text-zinc-400 font-bold">#{box.id.slice(-4)}</span>

              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {thumb ? (
                    <img src={thumb} alt={box.item_name} className="object-cover w-full h-full" />
                  ) : (
                    <Archive className="w-4 h-4 text-zinc-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-zinc-800 truncate">{box.item_name}</p>
                  <p className="text-[11px] font-medium text-zinc-400 truncate">{box.category ?? "—"}</p>
                </div>
              </div>

              <StatusPill status={box.type} />

              <span className="text-zinc-500 font-medium truncate">{box.reward || "—"}</span>

              <span className="text-zinc-500 font-medium whitespace-nowrap">
                {format(new Date(box.created_at), "d MMM yyyy")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
