"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  BellRing,
  ShieldQuestion,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/lib/language-context";
import {
  usePendingVerifications,
  type PendingVerification,
} from "@/lib/hooks/use-pending-verifications";
import { useWebPush } from "@/lib/hooks/use-web-push";
import { cn } from "@/lib/utils";

function StatusBadge({ status, t }: { status: PendingVerification["status"]; t: (key: string) => string }) {
  if (status === "passed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[9px] font-black shrink-0">
        <CheckCircle2 className="w-3 h-3" /> {t("verifyStatusPassed")}
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-2 py-0.5 text-[9px] font-black shrink-0">
        <XCircle className="w-3 h-3" /> {t("verifyStatusRejected")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[9px] font-black shrink-0">
      <Clock className="w-3 h-3" /> {t("verifyStatusPending")}
    </span>
  );
}

export function NotificationBell() {
  const { t } = useLanguage();
  const { items, count, reviewAttempt, reviewingId } = usePendingVerifications();
  const { status, subscribe } = useWebPush();

  // Агар иҷозат аллакай дода шуда бошад (масалан аз сессияи қаблӣ), бидуни
  // пурсиши нав обуна-ро дар фон нав мекунем — subscribe() дар ин ҳолат
  // ҳеҷ prompt намедиҳад, чунки браузер аллакай қарор кардааст.
  useEffect(() => {
    if (status === "granted") subscribe();
  }, [status, subscribe]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 rounded-2xl p-2 shadow-xl border-zinc-200/50 dark:border-zinc-800/50"
      >
        <div className="px-2 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-black tracking-widest text-zinc-400">
            {t("verifyNotifTitle")}
          </span>
          {count > 0 && (
            <span className="text-[9px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
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
          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-0.5">
            {items.map((item) => (
              <div
                key={item.attemptId}
                className={cn(
                  "rounded-xl border p-3 space-y-2 transition-colors",
                  item.status === "pending_review"
                    ? "border-amber-100 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/10"
                    : "border-zinc-100 dark:border-zinc-800",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/items/${item.itemId}`}
                    className="text-xs font-black text-zinc-800 dark:text-zinc-200 truncate hover:underline"
                  >
                    {item.itemTitle}
                  </Link>
                  <StatusBadge status={item.status} t={t} />
                </div>

                {item.matchedName && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    <ShieldQuestion className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {t("verifyMatchedAccount").replace("%{name}", item.matchedName)}
                    </span>
                  </div>
                )}

                {item.answers.length > 0 && (
                  <div className="space-y-1">
                    {item.answers.map((a) => (
                      <div key={a.question_id} className="text-[11px]">
                        <p className="font-bold text-zinc-400 truncate">{a.question_text}</p>
                        <p className="font-black text-zinc-700 dark:text-zinc-300 truncate">
                          {a.answer_type === "yesno"
                            ? a.given_answer === "yes"
                              ? t("verifyYes")
                              : t("verifyNo")
                            : a.given_answer}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {item.claimantPhone && (
                    <a
                      href={`tel:${item.claimantPhone}`}
                      title={t("call")}
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shrink-0 transition-transform active:scale-95"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {item.status === "pending_review" && (
                    <>
                      <Button
                        size="sm"
                        disabled={reviewingId === item.attemptId}
                        onClick={() => reviewAttempt(item.attemptId, true)}
                        className="flex-1 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black"
                      >
                        {reviewingId === item.attemptId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {t("verifyApprove")}
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reviewingId === item.attemptId}
                        onClick={() => reviewAttempt(item.attemptId, false)}
                        className="flex-1 h-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-[10px] font-black"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> {t("verifyReject")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
