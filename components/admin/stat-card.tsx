import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENTS = {
  blue: "bg-white text-blue-600",
  emerald: "bg-white text-emerald-600",
  amber: "bg-white text-amber-600",
  rose: "bg-white text-rose-600",
  sky: "bg-white text-sky-600",
} as const;

export function StatCard({
  icon: Icon,
  label,
  value,
  accent = "blue",
  hint,
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent?: keyof typeof ACCENTS;
  hint?: string;
  /** Фарқи фоизӣ нисбат ба давраи қаблӣ — танҳо вақте гузошта мешавад, ки маълумоти воқеӣ мавҷуд аст. */
  trend?: number;
}) {
  const hasTrend = typeof trend === "number" && Number.isFinite(trend);
  const positive = hasTrend && trend! >= 0;

  return (
    <div className="rounded-2xl bg-blue-50 p-4 shadow-sm h-full">
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold text-blue-600">{label}</p>
        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm", ACCENTS[accent])}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <p className="text-2xl font-black tracking-tight text-blue-900">{value}</p>
        {hasTrend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
              positive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
            )}
          >
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend!)}%
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] font-medium text-blue-600/70">{hint}</p>}
    </div>
  );
}
