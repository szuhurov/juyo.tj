"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

function tickFormat(granularity: "hour" | "day" | "month", d: string) {
  if (granularity === "hour") return format(parseISO(d), "HH:00");
  if (granularity === "month") return format(parseISO(d), "MMM yyyy");
  return format(parseISO(d), "d MMM");
}

export function DashboardLineChart({
  data,
  granularity = "day",
  height = 220,
}: {
  data: { date: string; count: number }[];
  granularity?: "hour" | "day" | "month";
  /** A number, or "100%" to fill a sized parent. */
  height?: number | `${number}%`;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => tickFormat(granularity, d)}
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip
          cursor={{ fill: "#f4f4f5" }}
          labelFormatter={(d) => tickFormat(granularity, d as string)}
          formatter={(value) => [value, "Корбарони нав"]}
          contentStyle={{ borderRadius: 12, border: "none", fontSize: 12, fontWeight: 600, boxShadow: "0 8px 24px -8px rgba(24,24,27,0.25)" }}
        />
        <Bar dataKey="count" fill="#2563eb" radius={[8, 8, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
