"use client";

import { use, useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { Archive, Package } from "lucide-react";
import { useDeletedAccountEntry, normalizeDeletedAccountSnapshot } from "@/lib/hooks/use-admin-users";
import { StatusPill } from "@/components/admin/status-pill";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tab = "items" | "saved";

export default function DeletedAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useDeletedAccountEntry(id);
  const [tab, setTab] = useState<Tab>("items");

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm font-bold text-red-600">Сабт ёфт нашуд</p>;
  }

  const snapshot = normalizeDeletedAccountSnapshot(data.entry);
  const { profile, items, savedItems } = snapshot;
  const name = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Беном";

  const tabs: { key: Tab; label: string }[] = [
    { key: "items", label: `Эълонҳо (${items.length})` },
    { key: "saved", label: `Захирашуда (${savedItems.length})` },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14 border border-zinc-100 grayscale opacity-70">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={name} />
            <AvatarFallback className="bg-zinc-100 text-zinc-500 font-bold text-lg">
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-zinc-900 tracking-tight">{name}</h1>
              <StatusPill status="deleted" />
            </div>
            <p className="text-xs font-medium text-zinc-400 mt-0.5">
              {profile.email || profile.phone || data.entry.user_id}
              {profile.created_at && ` · Пайваст шуда буд: ${format(new Date(profile.created_at), "d MMMM yyyy")}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold">
          <Archive className="w-4 h-4" />
          Пурра нест шуд: {format(new Date(data.entry.deleted_at), "d MMM yyyy, HH:mm")}
        </div>
      </div>

      <p className="text-xs font-medium text-zinc-400">
        Ин snapshot-и маълумот пеш аз пурра нест кардани ҳисоб аст — ашёҳо дигар дар система вуҷуд надоранд, барои
        ҳамин рӯйхатҳо танҳо барои дидан ҳастанд (click карда намешаванд).
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold transition-colors border",
              tab === t.key
                ? "bg-blue-50 border-blue-100 text-blue-600"
                : "bg-white border-zinc-100 text-zinc-500 hover:bg-zinc-50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "items" && (
        <ReadOnlyList
          empty="Ягон эълон набуд"
          rows={items.map((item) => ({
            key: item.id,
            title: item.title,
            subtitle: item.category,
            thumb: item.images?.[0]?.image_url,
            date: item.created_at,
            right: (
              <div className="flex items-center gap-1.5">
                <StatusPill status={item.type} variant="dot" />
                {item.is_resolved && <StatusPill status="resolved" variant="dot" />}
              </div>
            ),
          }))}
        />
      )}

      {tab === "saved" && (
        <ReadOnlyList
          empty="Ягон эълони захирашуда набуд"
          rows={savedItems
            .filter((s) => s.items)
            .map((s) => ({
              key: s.item_id,
              title: s.items!.title,
              subtitle: s.items!.category,
              thumb: s.items!.images?.[0]?.image_url,
              date: s.created_at,
              right: <StatusPill status={s.items!.type} variant="dot" />,
            }))}
        />
      )}

    </div>
  );
}

function ReadOnlyList({
  rows,
  empty,
}: {
  rows: { key: string; title: string; subtitle: string; thumb?: string | null; date: string; right: React.ReactNode }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm font-bold text-zinc-400">{empty}</p>;
  }

  return (
    <div className="rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
      <div className="divide-y divide-zinc-50 p-1.5 space-y-1">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-10 h-10 rounded-xl bg-zinc-100 overflow-hidden shrink-0 flex items-center justify-center">
                {row.thumb ? (
                  <Image src={row.thumb} alt={row.title} fill sizes="40px" className="object-cover" />
                ) : (
                  <Package className="w-4 h-4 text-zinc-300" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-zinc-800 truncate">{row.title}</p>
                <p className="text-[11px] font-medium text-zinc-400 truncate">{row.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[11px] font-medium text-zinc-400 whitespace-nowrap">
                {format(new Date(row.date), "d MMM yyyy")}
              </span>
              {row.right}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
