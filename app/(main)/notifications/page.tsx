/**
 * Саҳифаи пурраи огоҳиномаҳо — рӯйхати умумии санҷиши моликият ва эълонҳои
 * категория, бо филтрҳо (бо рақами ҳар филтр). Ҳар сатр на ба саҳифаи
 * эълон мегузарад, балки дар ҳамин ҷо кушода мешавад (аксаи эълон +
 * пайванди "Дидани эълон"). Сатрҳои нодидашуда рангашон фарқ мекунад;
 * кушодани сатр ранги ҳамон сатрро ба ҳолати одӣ мегузаронад.
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useLanguage } from "@/lib/language-context";
import { useNotifications, type NotificationItem } from "@/lib/hooks/use-notifications";
import { ClaimantAvatar } from "@/components/claimant-avatar";
import { Bell, BellRing, CheckCircle2, XCircle, Clock, Tag, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useWebPush } from "@/lib/hooks/use-web-push";

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
  const { items, loading, markOpened, isOpened } = useNotifications({
    verifyLimit: 200,
    categoryLimit: 100,
  });
  const { status, subscribe } = useWebPush();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const verificationItems = useMemo(() => items.filter((i) => i.kind === "verification"), [items]);
  const categoryItems = useMemo(() => items.filter((i) => i.kind === "category_post"), [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== "all" && item.kind !== typeFilter) return false;
      if (typeFilter === "verification" && statusFilter !== "all" && item.status !== statusFilter) return false;
      return true;
    });
  }, [items, typeFilter, statusFilter]);

  const typeFilters: { id: TypeFilter; label: string; count: number }[] = [
    { id: "all", label: t("notifFilterAll"), count: items.length },
    { id: "verification", label: t("notifFilterVerification"), count: verificationItems.length },
    { id: "category_post", label: t("notifFilterCategoryPost"), count: categoryItems.length },
  ];

  const statusFilters: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: t("notifFilterAll"), count: verificationItems.length },
    {
      id: "pending_review",
      label: t("verifyStatusPending"),
      count: verificationItems.filter((i) => i.status === "pending_review").length,
    },
    {
      id: "passed",
      label: t("verifyStatusPassed"),
      count: verificationItems.filter((i) => i.status === "passed").length,
    },
    {
      id: "rejected",
      label: t("verifyStatusRejected"),
      count: verificationItems.filter((i) => i.status === "rejected").length,
    },
  ];

  const toggleExpand = (item: NotificationItem) => {
    markOpened(item.id);
    setExpandedId((prev) => (prev === item.id ? null : item.id));
  };

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

      {status === "default" && (
        <button
          type="button"
          onClick={() => subscribe()}
          className="w-full flex items-center gap-3 rounded-2xl p-4 mb-5 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors text-left"
        >
          <BellRing className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
            {t("verifyEnablePush")}
          </span>
        </button>
      )}

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
                "shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black tracking-wide transition-all",
                typeFilter === f.id
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px]",
                  typeFilter === f.id
                    ? "bg-white/20 dark:bg-zinc-900/20"
                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500",
                )}
              >
                {f.count}
              </span>
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
                  "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                  statusFilter === f.id
                    ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-400",
                )}
              >
                {f.label}
                <span className="text-zinc-400">{f.count}</span>
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
            const expanded = expandedId === item.id;
            const unread = !isOpened(item.id);
            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-2xl border overflow-hidden transition-colors",
                  unread
                    ? "bg-blue-50/60 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900/30"
                    : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(item)}
                  className="w-full flex items-center gap-3 p-4 text-left"
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
                  {unread && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                  <KindIcon item={item} />
                </button>
                {expanded && (
                  <div className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800 pt-3.5">
                    {item.itemImageUrl && (
                      <img
                        src={item.itemImageUrl}
                        alt=""
                        className="w-full h-40 object-cover rounded-xl mb-3"
                      />
                    )}
                    <Link
                      href={`/items/${item.itemId}`}
                      className="flex items-center justify-center gap-2 h-11 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black text-xs shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                      {item.itemTitle}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
