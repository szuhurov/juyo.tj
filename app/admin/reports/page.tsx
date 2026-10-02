"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag, Trash2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { useAdminReports, useUpdateReport, type AdminReportRow } from "@/lib/hooks/use-admin-reports";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { id: "open", label: "Кушода" },
  { id: "resolved", label: "Хомӯш шуд" },
  { id: "dismissed", label: "Рад шуд" },
  { id: "all", label: "Ҳама" },
] as const;

const REASON_LABEL: Record<AdminReportRow["reason"], string> = {
  spam: "Спам ё реклама",
  scam: "Қаллобӣ",
  offensive: "Мундариҷаи таҳқиромез",
  personal_info: "Маълумоти шахсӣ",
  fake: "Эълони бардурӯғ",
  other: "Дигар",
};

const ITEM_STATUS_LABEL: Record<string, string> = {
  approved: "Нашр шуда",
  pending: "Пинҳон / дар санҷиш",
  rejected: "Хомӯш",
};

/** User reports on listings (App Store Review 1.2) — timely review by the admin. */
export default function AdminReportsPage() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["id"]>("open");
  const { data, isLoading, isError } = useAdminReports(status);
  const updateReport = useUpdateReport();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Flag className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 text-rose-500 dark:text-rose-400" />
        <h1 className="text-lg min-[1084px]:text-xl font-bold text-zinc-900 dark:text-white">Шикоятҳо</h1>
      </div>

      <div className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-4 space-y-4">
        <div className="flex bg-zinc-100/60 dark:bg-zinc-800/60 p-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-700/50 w-fit">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatus(tab.id)}
              className={cn(
                "px-4 min-[1084px]:px-5 h-9 min-[1084px]:h-10 rounded-md font-medium text-[11px] min-[1084px]:text-xs tracking-wider transition-all",
                status === tab.id
                  ? "bg-emerald-500 text-white"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isError ? (
          <p className="py-16 text-center text-sm font-semibold text-rose-500 dark:text-rose-400">Хатогӣ ҳангоми боркунӣ</p>
        ) : isLoading || !data ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-md" />
            ))}
          </div>
        ) : data.reports.length === 0 ? (
          <p className="py-16 text-center text-sm font-semibold text-zinc-400">Ягон шикоят нест</p>
        ) : (
          <div className="space-y-2">
            {data.reports.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-md border border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex gap-3 min-w-0">
                  {r.item_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.item_image} alt="" className="w-16 h-16 rounded-md object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-zinc-100 dark:bg-zinc-700 shrink-0" />
                  )}
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-sm min-[1084px]:text-base text-zinc-900 dark:text-white truncate">
                      {r.item_title ?? "Эълон нест карда шудааст"}
                    </p>
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{REASON_LABEL[r.reason]}</p>
                    {r.details && (
                      <p className="text-xs min-[1084px]:text-[13px] text-zinc-600 dark:text-zinc-300 italic max-w-xl">&ldquo;{r.details}&rdquo;</p>
                    )}
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {new Date(r.created_at).toLocaleString("tg-TJ")} · аз {r.reporter_name || r.reporter_id}
                      {r.reported_user_name ? ` · муаллиф: ${r.reported_user_name}` : ""}
                      {r.item_status ? ` · ${ITEM_STATUS_LABEL[r.item_status] ?? r.item_status}` : ""}
                    </p>
                    {r.item_id && (
                      <Link
                        href={`/items/${r.item_id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> Дидани эълон
                      </Link>
                    )}
                  </div>
                </div>
                {r.status === "open" && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateReport.isPending}
                      onClick={() => updateReport.mutate({ id: r.id, action: "dismiss" })}
                      className="h-9 rounded-md font-medium text-[10px] tracking-widest gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Радд
                    </Button>
                    {r.item_id && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateReport.isPending}
                          onClick={() => updateReport.mutate({ id: r.id, action: "keep_item" })}
                          className="h-9 rounded-md font-medium text-[10px] tracking-widest gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Вайронкорӣ нест
                        </Button>
                        <Button
                          size="sm"
                          disabled={updateReport.isPending}
                          onClick={() => {
                            if (window.confirm("Эълон барои ҳама хомӯш карда мешавад. Мутмаин ҳастед?")) {
                              updateReport.mutate({ id: r.id, action: "remove_item" });
                            }
                          }}
                          className="h-9 rounded-md font-medium text-[10px] tracking-widest gap-1.5 bg-rose-500 hover:bg-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Хомӯш кардани эълон
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
