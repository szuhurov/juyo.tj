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

  // If permission was already granted (e.g. from a previous session), we
  // silently refresh the subscription in the background without a new
  // prompt — subscribe() shows no prompt in this case, since the browser
  // has already decided.
  useEffect(() => {
    if (status === "granted") subscribe();
  }, [status, subscribe]);

  return (
    <Link href="/notifications" onClick={() => markAllSeen()}>
      <Button
        variant="secondary"
        size="sm"
        aria-label={t("notifications")}
        className="relative h-9 w-9 sm:h-10 sm:w-10 min-[1084px]:h-11 min-[1084px]:w-11 min-[1920px]:h-12 min-[1920px]:w-12 p-0 rounded-md border-none shadow-none bg-white dark:bg-zinc-800"
      >
        <Bell className="h-4 w-4 sm:h-[18px] sm:w-[18px] min-[1084px]:h-5 min-[1084px]:w-5 min-[1920px]:h-[22px] min-[1920px]:w-[22px] text-zinc-500 dark:text-zinc-400" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 min-[1084px]:h-[18px] min-[1084px]:min-w-[18px] min-[1920px]:h-5 min-[1920px]:min-w-5 px-1 rounded-full bg-red-500 text-white text-[9px] min-[1084px]:text-[10px] min-[1920px]:text-[11px] font-bold flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>
    </Link>
  );
}
