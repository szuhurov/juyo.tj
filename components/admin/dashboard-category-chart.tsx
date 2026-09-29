"use client";

/**
 * Listings by category — horizontal bars (was a donut): one series, so one
 * hue (#3b82f6, validated ≥3:1 on the light and #232e3c dark surfaces),
 * sorted largest first, value + share labelled at the bar end.
 */
const BAR_COLOR = "#3b82f6";

export function DashboardCategoryChart({ data }: { data: { category: string; count: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-xs font-medium text-zinc-400">
        Ҳанӯз эълон нест
      </div>
    );
  }

  const rows = [...data].sort((a, b) => b.count - a.count);
  const total = rows.reduce((sum, d) => sum + d.count, 0);
  const max = rows[0]?.count || 1;

  return (
    <ul className="space-y-1" aria-label="Эълонҳо аз рӯи категория">
      {rows.map((entry) => {
        const pct = total > 0 ? Math.round((entry.count / total) * 100) : 0;
        return (
          <li
            key={entry.category}
            title={`${entry.category}: ${entry.count} (${pct}%)`}
            className="group grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 rounded-md px-1.5 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-700/40"
          >
            <span className="truncate text-xs font-medium text-zinc-600 dark:text-zinc-300">{entry.category}</span>
            <span className="h-3 rounded-r-[4px] bg-transparent">
              <span
                className="block h-full rounded-r-[4px] transition-[width] duration-300"
                style={{ width: `${Math.max((entry.count / max) * 100, 2)}%`, backgroundColor: BAR_COLOR }}
              />
            </span>
            <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{entry.count}</span> · {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
