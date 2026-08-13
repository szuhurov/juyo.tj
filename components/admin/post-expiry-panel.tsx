"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, BellRing, Trash2, AlertTriangle } from "lucide-react";
import { useAdminSettings, useUpdateAdminSettings } from "@/lib/hooks/use-admin-settings";

interface ExpiryStats {
  total: number;
  withoutExpiry: number;
  expiringIn30Days: number;
  awaitingConfirm: number;
  postLifetimeDays: number;
}

/**
 * Давраи ҳаёти эълонҳо: мӯҳлат + омор.
 *
 * Ҷараён пурра ХУДКОР аст — cron-и рӯзонаи 02:00 огоҳиномаро мефиристад ва
 * несткуниро иҷро мекунад. Ин панел танҳо мӯҳлатро танзим мекунад ва вазъро
 * нишон медиҳад; ҳеҷ тугмаи «фиристодан» надорад ва набояд дошта бошад.
 */
export function PostExpiryPanel() {
  const { data: settingsData } = useAdminSettings();
  const { mutate, isPending } = useUpdateAdminSettings();

  const { data: stats, isLoading } = useQuery<ExpiryStats>({
    queryKey: ["admin", "expiry-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/expiry-stats");
      if (!res.ok) throw new Error("Хатогӣ дар боркунии омор");
      return res.json();
    },
    staleTime: 60_000,
  });

  const savedDays = settingsData?.settings?.post_lifetime_days ?? 180;
  const [days, setDays] = useState(String(savedDays));

  // Синхронизатсия аз сервер — вагарна пас аз боршавии танзимот майдон
  // қимати кӯҳнаро нишон медод.
  useEffect(() => {
    setDays(String(savedDays));
  }, [savedDays]);

  const parsed = Number(days);
  const invalid = !Number.isInteger(parsed) || parsed < 7 || parsed > 3650;
  const changed = parsed !== savedDays;

  const save = () => {
    if (invalid || !changed) return;
    mutate(
      { post_lifetime_days: parsed },
      {
        onSuccess: () => toast.success(`Мӯҳлат ${parsed} рӯз шуд`),
        onError: (err: Error) => toast.error(err.message || "Хатогӣ рух дод"),
      },
    );
  };

  if (isLoading) return null;

  return (
    <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <CalendarClock className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Мӯҳлати эълонҳо</h3>
          <p className="text-[11px] font-bold text-zinc-400">
            72 соат пеш аз мӯҳлат огоҳинома меравад · ҳар рӯз 02:00, худкор
          </p>
        </div>
      </div>

      <div className="flex items-end gap-2">
        <label className="flex-1 min-w-0">
          <span className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
            Мӯҳлат (рӯз)
          </span>
          <input
            type="number"
            min={7}
            max={3650}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-full h-11 rounded-xl px-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={invalid || !changed || isPending}
          className="h-11 px-5 shrink-0 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-40 transition-opacity"
        >
          Нигоҳ дор
        </button>
      </div>
      {invalid && (
        <p className="text-[11px] font-bold text-red-600 dark:text-red-400">
          Байни 7 ва 3650 рӯз бошад
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={CalendarClock} label="Дар 30 рӯз" value={stats?.expiringIn30Days ?? 0} tone="blue" />
        <Stat icon={BellRing} label="Огоҳӣ рафт" value={stats?.awaitingConfirm ?? 0} tone="amber" />
        <Stat icon={Trash2} label="Ҳамагӣ эълон" value={stats?.total ?? 0} tone="zinc" />
      </div>

      {/* Ин рақам бояд ҲАМЕША 0 бошад — trigger `expires_at`-ро ҳангоми сабт
          мегузорад. Агар аз 0 зиёд шавад, trigger кор намекунад ва он
          эълонҳо ҳаргиз нест намешаванд. */}
      {(stats?.withoutExpiry ?? 0) > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 p-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <p className="text-[11px] font-bold text-red-700 dark:text-red-400 leading-relaxed">
            {stats?.withoutExpiry} эълон бе мӯҳлат аст — trigger кор намекунад ва онҳо ҳаргиз нест
            намешаванд.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: number;
  tone: "blue" | "amber" | "zinc";
}) {
  const tones = {
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
    zinc: "text-zinc-500 dark:text-zinc-400",
  } as const;

  return (
    <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3">
      <Icon className={`w-4 h-4 mb-1.5 ${tones[tone]}`} />
      <p className="text-lg font-bold text-zinc-900 dark:text-white leading-none">{value}</p>
      <p className="text-[10px] font-bold text-zinc-400 mt-1 truncate">{label}</p>
    </div>
  );
}
