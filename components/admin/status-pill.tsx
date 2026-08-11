import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100",
  deleted: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800",
  purged: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-500/20",
  pending: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-100",
  pending_review: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-100",
  approved: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100",
  passed: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100",
  rejected: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-500/20",
  resolved: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100",
  lost: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-500/20",
  found: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Фаъол",
  deleted: "Нест шуда",
  purged: "Пурра",
  pending: "Дар интизор",
  pending_review: "Дар интизор",
  approved: "Тасдиқшуда",
  passed: "Гузашт",
  rejected: "Рад шуд",
  resolved: "Ҳалшуда",
  lost: "Гумшуда",
  found: "Ёфтшуда",
};

const DOT_STYLES: Record<string, string> = {
  active: "bg-emerald-500 text-emerald-600 dark:text-emerald-400",
  deleted: "bg-zinc-400 text-zinc-500 dark:text-zinc-400",
  purged: "bg-rose-500 text-rose-600 dark:text-rose-400",
  pending: "bg-rose-500 text-rose-600 dark:text-rose-400",
  pending_review: "bg-rose-500 text-rose-600 dark:text-rose-400",
  approved: "bg-emerald-500 text-emerald-600 dark:text-emerald-400",
  passed: "bg-emerald-500 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-rose-500 text-rose-600 dark:text-rose-400",
  resolved: "bg-emerald-500 text-emerald-600 dark:text-emerald-400",
  lost: "bg-rose-500 text-rose-600 dark:text-rose-400",
  found: "bg-blue-500 text-blue-600 dark:text-blue-400",
};

export function StatusPill({
  status,
  label,
  variant = "pill",
}: {
  status: string;
  label?: string;
  variant?: "pill" | "dot";
}) {
  if (variant === "dot") {
    const [dotColor, textColor] = (DOT_STYLES[status] ?? "bg-zinc-400 text-zinc-500 dark:text-zinc-400").split(" ");
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap", textColor)}>
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
        {label ?? STATUS_LABELS[status] ?? status}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center justify-self-start rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap",
        STATUS_STYLES[status] ?? "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 border-zinc-100 dark:border-zinc-800",
      )}
    >
      {label ?? STATUS_LABELS[status] ?? status}
    </span>
  );
}
