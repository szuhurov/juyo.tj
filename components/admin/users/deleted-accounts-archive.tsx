"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useAdminUsers } from "@/lib/hooks/use-admin-users";
import { useDeletedAccountsArchive, normalizeDeletedAccountSnapshot } from "@/lib/hooks/use-admin-users";
import { StatusPill } from "@/components/admin/status-pill";

interface CombinedRow {
  key: string;
  href: string;
  name: string;
  subtitle: string;
  date: string;
  kind: "trash" | "purged";
}

export function DeletedAccountsArchive() {
  const router = useRouter();
  const { data: trashData, isLoading: trashLoading } = useAdminUsers({ status: "deleted", page: 0, pageSize: 200 });
  const { data: archiveData, isLoading: archiveLoading } = useDeletedAccountsArchive();

  if (trashLoading || archiveLoading) {
    return <p className="py-16 text-center text-sm font-semibold text-zinc-400">Боркунӣ...</p>;
  }

  const trashRows: CombinedRow[] = (trashData?.users ?? []).map((u) => ({
    key: `trash-${u.id}`,
    href: `/admin/users/${u.id}`,
    name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Беном",
    subtitle: u.email || u.phone || u.id,
    date: u.deleted_at ?? u.created_at,
    kind: "trash",
  }));

  const purgedRows: CombinedRow[] = (archiveData?.entries ?? []).map((entry) => {
    const { profile } = normalizeDeletedAccountSnapshot(entry);
    return {
      key: `purged-${entry.id}`,
      href: `/admin/users/deleted-archive/${entry.id}`,
      name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Беном",
      subtitle: profile.email || profile.phone || entry.user_id,
      date: entry.deleted_at,
      kind: "purged",
    };
  });

  const rows = [...trashRows, ...purgedRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm font-semibold text-zinc-400">Ягон корбари нестшуда нест</p>;
  }

  return (
    <div className="rounded-md border border-zinc-100 dark:border-zinc-800 overflow-hidden">
      <div className="divide-y divide-zinc-50 p-1.5 space-y-1">
        {rows.map((row) => (
          <div
            key={row.key}
            onClick={() => router.push(row.href)}
            className="group flex items-center justify-between gap-3 px-3 py-2.5 rounded-md cursor-pointer hover:bg-blue-600 transition-all"
          >
            <div className="min-w-0">
              <p className="font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-white text-sm truncate">{row.name}</p>
              <p className="text-[11px] font-medium text-zinc-400 group-hover:text-blue-100 truncate">{row.subtitle}</p>
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
