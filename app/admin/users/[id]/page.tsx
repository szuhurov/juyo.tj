"use client";

import { use, useState } from "react";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { useAdminUser } from "@/lib/hooks/use-admin-users";
import { UserDetailHeader } from "@/components/admin/users/user-detail-header";
import { UserEditForm } from "@/components/admin/users/user-edit-form";
import { UserPostsPanel } from "@/components/admin/users/user-posts-panel";
import { UserSavedItems } from "@/components/admin/users/user-saved-items";
import { UserQrStats } from "@/components/admin/users/user-qr-stats";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "items" | "saved" | "qr";

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useAdminUser(id);
  const [tab, setTab] = useState<Tab>("items");

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-md" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm font-semibold text-red-600 dark:text-red-400">Корбар ёфт нашуд</p>;
  }

  const items = data.items ?? [];
  const savedItems = data.savedItems ?? [];

  const tabs: { key: Tab; label: string }[] = [
    { key: "items", label: `Эълонҳои корбар (${items.length})` },
    { key: "saved", label: `Захирашуда (${savedItems.length})` },
    { key: "qr", label: "QR" },
  ];

  return (
    <div className="space-y-5">
      <UserDetailHeader profile={data.profile} />
      <div className="flex justify-end">
        <Button asChild size="sm" variant="outline" className="rounded-md">
          <Link href={`/admin/post-as-user?userId=${id}`}>
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Илова кардани элон аз номи ин корбар
          </Link>
        </Button>
      </div>
      <UserEditForm profile={data.profile} />

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-medium transition-colors border",
              tab === t.key
                ? "bg-blue-50 dark:bg-blue-500/10 border-blue-100 text-blue-600 dark:text-blue-400"
                : "bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "items" && <UserPostsPanel userId={id} />}
      {tab === "saved" && <UserSavedItems savedItems={savedItems} />}
      {tab === "qr" && <UserQrStats profile={data.profile} />}
    </div>
  );
}
