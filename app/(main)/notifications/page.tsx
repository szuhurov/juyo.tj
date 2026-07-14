/**
 * Саҳифаи пурраи огоҳиномаҳо — рӯйхати умумии санҷиши моликият ва эълонҳои
 * категория, бо филтрҳо, ҷудо аз менюи хурди занг (ки танҳо чанд охиринро
 * нишон медиҳад).
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useLanguage } from "@/lib/language-context";
import { useNotifications, type NotificationItem } from "@/lib/hooks/use-notifications";
import { ClaimantAvatar } from "@/components/claimant-avatar";
import { Bell, CheckCircle2, XCircle, Clock, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type TypeFilter = "all" | "verification" | "category_post";
type StatusFilter = "all" | "pending_review" | "passed" | "rejected";

function KindIcon({ item }: { item: NotificationItem }) {
  if (item.kind === "category_post") return <Tag className="w-4 h-4 text-blue-500 shrink-0" />;
  if (item.status === "passed") return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (item.status === "rejected") return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  return <Clock className="w-4 h-4 text-amber-500 shrink-0" />;
}

export default function NotificationsPage() {
  const { t } = useLanguage();
  const { items, loading } = useNotifications({ verifyLimit: 200, categoryLimit: 100 });
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== "all" && item.kind !== typeFilter) return false;
      if (typeFilter === "verification" && statusFilter !== "all" && item.status !== statusFilter) return false;
      return true;
    });
  }, [items, typeFilter, statusFilter]);

  const typeFilters: { id: TypeFilter; label: string }[] = [
    { id: "all", label: t("notifFilterAll") },
    { id: "verification", label: t("notifFilterVerification") },
    { id: "category_post", label: t("notifFilterCategoryPost") },
  ];

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: "all", label: t("notifFilterAll") },
    { id: "pending_review", label: t("verifyStatusPending") },
    { id: "passed", label: t("verifyStatusPassed") },
    { id: "rejected", label: t("verifyStatusRejected") },
  ];

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </div>
        <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">
          {t("notifPageTitle")}
        </h1>
      </div>

      {/* Филтрҳо */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {typeFilters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setTypeFilter(f.id);
                if (f.id !== "verification") setStatusFilter("all");
              }}
              className={cn(
                "shrink-0 px-4 py-2 rounded-xl text-[11px] font-black tracking-wide transition-all",
                typeFilter === f.id
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {typeFilter === "verification" && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusFilters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                  statusFilter === f.id
                    ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-400",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Рӯйхат */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-sm font-medium text-zinc-400">{t("verifyNotifEmpty")}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const name = item.kind === "verification" ? item.claimantName : item.posterName;
            const avatar = item.kind === "verification" ? item.claimantAvatar : item.posterAvatar;
            const subtitle = item.kind === "verification" ? item.itemTitle : t("categoryPostNotifLine");
            return (
              <Link
                key={item.id}
                href={`/items/${item.itemId}`}
                className="flex items-center gap-3 rounded-2xl border border-zinc-100 dark:border-zinc-900 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
              >
                <ClaimantAvatar url={avatar ?? null} name={name ?? null} className="w-11 h-11 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                    {item.kind === "verification" ? name || t("verifyUnknownClaimant") : item.itemTitle}
                  </p>
                  <p className="text-xs text-zinc-400 font-medium truncate">{subtitle}</p>
                  <p className="text-[10px] text-zinc-300 dark:text-zinc-600 font-bold mt-0.5">
                    {format(new Date(item.createdAt), "dd.MM.yyyy HH:mm")}
                  </p>
                </div>
                <KindIcon item={item} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
