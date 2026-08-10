"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { useAdminReports, useUpdateReport } from "@/lib/hooks/use-admin-reports";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { id: "pending", label: "Дар интизор" },
  { id: "reviewed", label: "Баррасишуда" },
  { id: "dismissed", label: "Радшуда" },
  { id: "all", label: "Ҳама" },
] as const;

const REASON_LABELS: Record<string, string> = {
  spam: "Спам",
  inappropriate: "Контенти номуносиб",
  fake: "Эълони бардурӯғ",
  offensive: "Таҳқиромез",
  other: "Дигар",
};

export default function AdminReportsPage() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["id"]>("pending");
  const { data, isLoading, isError } = useAdminReports(status);
  const updateReport = useUpdateReport();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Flag className="w-5 h-5 min-[1084px]:w-6 min-[1084px]:h-6 text-rose-500" />
        <h1 className="text-lg min-[1084px]:text-xl font-bold text-zinc-900">Шикоятҳо (Reports)</h1>
      </div>

      <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm space-y-4">
        <div className="flex bg-zinc-100/60 p-0.5 rounded-lg border border-zinc-200/50 w-fit">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatus(tab.id)}
              className={cn(
                "px-4 min-[1084px]:px-5 h-9 min-[1084px]:h-10 rounded-lg font-bold text-[11px] min-[1084px]:text-xs tracking-wider transition-all",
                status === tab.id
                  ? "bg-emerald-500 text-white shadow-md"
                  : "text-zinc-500 hover:text-zinc-900",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isError ? (
          <p className="py-16 text-center text-sm font-bold text-rose-500">Хатогӣ ҳангоми боркунӣ</p>
        ) : isLoading || !data ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : data.reports.length === 0 ? (
          <p className="py-16 text-center text-sm font-bold text-zinc-400">Ягон шикоят нест</p>
        ) : (
          <div className="space-y-2">
            {data.reports.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-xl border border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 text-[10px] min-[1084px]:text-[11px] font-bold tracking-wider">
                      {REASON_LABELS[r.reason] ?? r.reason}
                    </span>
                    <Link
                      href={`/admin/posts/${r.item_id}`}
                      className="font-bold text-sm min-[1084px]:text-base text-zinc-900 hover:text-blue-600 inline-flex items-center gap-1"
                    >
                      {r.items?.title ?? r.item_id}
                      <ExternalLink className="w-3 h-3 min-[1084px]:w-3.5 min-[1084px]:h-3.5" />
                    </Link>
                  </div>
                  <p className="text-xs min-[1084px]:text-[13px] text-zinc-500">
                    Аз: {r.reporter?.first_name || "Корбар"} {r.reporter?.last_name || ""} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("tg-TJ")}
                  </p>
                  {r.details && (
                    <p className="text-xs min-[1084px]:text-[13px] text-zinc-600 italic max-w-xl">&ldquo;{r.details}&rdquo;</p>
                  )}
                </div>
                {r.status === "pending" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateReport.isPending}
                      onClick={() => updateReport.mutate({ id: r.id, status: "dismissed" })}
                      className="h-9 min-[1084px]:h-10 rounded-lg font-bold text-[9px] min-[1084px]:text-[10px] tracking-widest gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5 min-[1084px]:w-4 min-[1084px]:h-4" />
                      Радд
                    </Button>
                    <Button
                      size="sm"
                      disabled={updateReport.isPending}
                      onClick={() => {
                        if (window.confirm("Ашё нест карда мешавад. Мутмаин ҳастед?")) {
                          updateReport.mutate({ id: r.id, status: "reviewed" });
                        }
                      }}
                      className="h-9 min-[1084px]:h-10 rounded-lg font-bold text-[9px] min-[1084px]:text-[10px] tracking-widest gap-1.5 bg-emerald-500 hover:bg-emerald-600"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 min-[1084px]:w-4 min-[1084px]:h-4" />
                      Тасдиқ ва нест кардан
                    </Button>
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
