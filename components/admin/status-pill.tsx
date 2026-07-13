import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-100",
  deleted: "bg-zinc-100 text-zinc-500 border-zinc-200",
  purged: "bg-rose-50 text-rose-700 border-rose-100",
  pending: "bg-amber-50 text-amber-700 border-amber-100",
  pending_review: "bg-amber-50 text-amber-700 border-amber-100",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-100",
  passed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  rejected: "bg-rose-50 text-rose-700 border-rose-100",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-100",
  lost: "bg-rose-50 text-rose-700 border-rose-100",
  found: "bg-blue-50 text-blue-700 border-blue-100",
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
  active: "bg-emerald-500 text-emerald-600",
  deleted: "bg-zinc-400 text-zinc-500",
  purged: "bg-rose-500 text-rose-600",
  pending: "bg-rose-500 text-rose-600",
  pending_review: "bg-rose-500 text-rose-600",
  approved: "bg-emerald-500 text-emerald-600",
  passed: "bg-emerald-500 text-emerald-600",
  rejected: "bg-rose-500 text-rose-600",
  resolved: "bg-emerald-500 text-emerald-600",
  lost: "bg-rose-500 text-rose-600",
  found: "bg-blue-500 text-blue-600",
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
    const [dotColor, textColor] = (DOT_STYLES[status] ?? "bg-zinc-400 text-zinc-500").split(" ");
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
        STATUS_STYLES[status] ?? "bg-zinc-50 text-zinc-500 border-zinc-100",
      )}
    >
      {label ?? STATUS_LABELS[status] ?? status}
    </span>
  );
}
