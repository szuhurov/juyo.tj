import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENTS = {
  blue: "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400",
  emerald: "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400",
  amber: "bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400",
  rose: "bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400",
  sky: "bg-white dark:bg-zinc-800 text-sky-600 dark:text-sky-400",
} as const;

export function StatCard({
  icon: Icon,
  label,
  value,
  accent = "blue",
  hint,
  trend,
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent?: keyof typeof ACCENTS;
  hint?: string;
  /** Percentage change vs. the previous period — only set when real data is available. */
  trend?: number;
  /** Makes the card a filter toggle (users page). */
  onClick?: () => void;
  active?: boolean;
}) {
  const hasTrend = typeof trend === "number" && Number.isFinite(trend);
  const positive = hasTrend && trend! >= 0;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? !!active : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={cn(
        "rounded-md bg-blue-50 dark:bg-blue-500/10 p-4 h-full border border-zinc-200 dark:border-zinc-800",
        onClick && "cursor-pointer transition-colors hover:border-blue-300 dark:hover:border-blue-500/50",
        active && "border-blue-600 ring-1 ring-blue-600 dark:border-blue-400 dark:ring-blue-400",
      )}
    >
      <p className="text-xs font-medium text-blue-600 dark:text-blue-400">{label}</p>
      {/* Icon beside the number (owner request), not in the corner. */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", ACCENTS[accent])}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-2xl font-semibold tracking-tight text-blue-900 dark:text-blue-200">{value}</p>
        {hasTrend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
              positive ? "bg-emerald-100 text-emerald-700 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400",
            )}
          >
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend!)}%
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] font-medium text-blue-600/70 dark:text-blue-400/70">{hint}</p>}
    </div>
  );
}
