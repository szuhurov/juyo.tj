"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { useWebPush } from "@/lib/hooks/use-web-push";
import { useLanguage } from "@/lib/language-context";

export function NotificationBell() {
  const { count, markAllSeen } = useNotifications();
  const { status, subscribe } = useWebPush();
  const { t } = useLanguage();

  // Агар иҷозат аллакай дода шуда бошад (масалан аз сессияи қаблӣ), бидуни
  // пурсиши нав обуна-ро дар фон нав мекунем — subscribe() дар ин ҳолат
  // ҳеҷ prompt намедиҳад, чунки браузер аллакай қарор кардааст.
  useEffect(() => {
    if (status === "granted") subscribe();
  }, [status, subscribe]);

  return (
    <Link href="/notifications" onClick={() => markAllSeen()}>
      <Button
        variant="secondary"
        size="sm"
        aria-label={t("notifications")}
        className="relative h-10 w-10 p-0 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
      >
        <Bell className="h-[18px] w-[18px] text-zinc-600 dark:text-zinc-400" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>
    </Link>
  );
}
