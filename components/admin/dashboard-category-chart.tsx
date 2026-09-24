"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#2563eb", "#60a5fa", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa"];

export function DashboardCategoryChart({ data }: { data: { category: string; count: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-[170px] flex items-center justify-center text-xs font-medium text-zinc-400">
        Ҳанӯз эълон нест
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="w-full sm:flex-1 sm:min-w-0 space-y-1.5 order-1">
        {data.map((entry, i) => {
          const pct = total > 0 ? Math.round((entry.count / total) * 100) : 0;
          return (
            <div key={entry.category} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-zinc-500 dark:text-zinc-400 font-medium truncate flex-1">{entry.category}</span>
              <span className="text-zinc-400 font-semibold">{pct}%</span>
            </div>
          );
        })}
      </div>
      <div className="w-[110px] h-[110px] shrink-0 mx-auto sm:mx-0 order-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="category" innerRadius={32} outerRadius={52} paddingAngle={2}>
              {data.map((entry, i) => (
                <Cell key={entry.category} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 12, fontWeight: 600, boxShadow: "0 8px 24px -8px rgba(24,24,27,0.25)" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
