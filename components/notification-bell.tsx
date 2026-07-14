"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Bell, BellRing, CheckCircle2, XCircle, Clock, Tag, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/lib/language-context";
import { useNotifications, type NotificationItem } from "@/lib/hooks/use-notifications";
import { useWebPush } from "@/lib/hooks/use-web-push";
import { ClaimantAvatar } from "@/components/claimant-avatar";

function KindIcon({ item }: { item: NotificationItem }) {
  if (item.kind === "category_post") return <Tag className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
  if (item.status === "passed") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  if (item.status === "rejected") return <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
  return <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
}

export function NotificationBell() {
  const { t } = useLanguage();
  const { items, count, markAllSeen } = useNotifications();
  const { status, subscribe } = useWebPush();

  // Агар иҷозат аллакай дода шуда бошад (масалан аз сессияи қаблӣ), бидуни
  // пурсиши нав обуна-ро дар фон нав мекунем — subscribe() дар ин ҳолат
  // ҳеҷ prompt намедиҳад, чунки браузер аллакай қарор кардааст.
  useEffect(() => {
    if (status === "granted") subscribe();
  }, [status, subscribe]);

  const bellButton = (
    <Button
      variant="secondary"
      size="sm"
      className="relative h-9 w-9 p-0 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
    >
      <Bell className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Button>
  );

  // Агар огоҳиномаи нав бошад, click мустақим ба саҳифаи пурра мебарад —
  // dropdown-и хурд кушода намешавад.
  if (count > 0) {
    return (
      <Link href="/notifications" onClick={() => markAllSeen()}>
        {bellButton}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{bellButton}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 rounded-2xl p-2 shadow-xl border-zinc-200/50 dark:border-zinc-800/50"
      >
        <div className="px-2 py-1.5 text-[10px] font-black tracking-widest text-zinc-400">
          {t("verifyNotifTitle")}
        </div>
        {status === "default" && (
          <button
            type="button"
            onClick={() => subscribe()}
            className="w-full flex items-center gap-2.5 rounded-xl p-3 mb-1 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors text-left"
          >
            <BellRing className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              {t("verifyEnablePush")}
            </span>
          </button>
        )}
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs font-medium text-zinc-400">
            {t("verifyNotifEmpty")}
          </div>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {items.map((item) => {
              const name = item.kind === "verification" ? item.claimantName : item.posterName;
              const avatar = item.kind === "verification" ? item.claimantAvatar : item.posterAvatar;
              const subtitle = item.kind === "verification" ? item.itemTitle : t("categoryPostNotifLine");
              return (
                <Link
                  key={item.id}
                  href={`/items/${item.itemId}`}
                  className="flex items-start gap-3 rounded-xl p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <ClaimantAvatar url={avatar ?? null} name={name ?? null} className="w-8 h-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                      {item.kind === "verification"
                        ? name || t("verifyUnknownClaimant")
                        : item.itemTitle}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-medium truncate">{subtitle}</p>
                  </div>
                  <KindIcon item={item} />
                </Link>
              );
            })}
          </div>
        )}
        <Link
          href="/notifications"
          className="mt-1 flex items-center justify-center gap-1 rounded-xl p-2.5 text-[10px] font-black tracking-widest text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          {t("notifSeeAll")}
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
