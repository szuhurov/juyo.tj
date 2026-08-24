/**
 * Слайдери фоизи ТАҚСИМИ ду ранги градиент (bias) — нусхаи веб.
 *
 * Native-и ин компонент (`components/PercentSlider.tsx`) бо
 * `react-native-gesture-handler` кор мекунад, зеро React Native
 * слайдери БУНЁДӢ надорад. Веб чунин ниёз надорад — браузер худаш
 * кашидани `<input type="range">`-ро медиҳад (муш ва ангушт, бе
 * gesture-и мустақил). Ин соддакунии қасдист: натиҷаи визуалӣ ва
 * рафтори функсионалӣ (track/fill/thumb, min/max, тағйир) якхела.
 */
"use client";

import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function PercentSlider({
  value,
  onChange,
  min = 10,
  max = 90,
}: {
  /** 0–100 */
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const pct = Math.round(Math.min(max, Math.max(min, value)));

  return (
    <div className="pt-1 px-1">
      <div className="relative">
        <div
          className="absolute -top-5 -translate-x-1/2 text-[9px] font-bold text-white bg-zinc-900 dark:bg-zinc-700 rounded px-1.5 py-0.5 pointer-events-none"
          style={{ left: `${pct}%` }}
        >
          {pct}%
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={pct}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-100 dark:bg-zinc-800 accent-emerald-500",
          )}
        />
      </div>
    </div>
  );
}

/** Рақам (%) + тугмаи давр — пахши рақам слайдери тақсимотро кушояд/пӯшонад. */
export function GradientBiasToggle({
  percent,
  open,
  onToggle,
  onRotate,
}: {
  percent: number;
  open: boolean;
  onToggle: () => void;
  onRotate: () => void;
}) {
  const pct = Math.round(percent);
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="ml-auto text-[11px] font-bold text-zinc-600 dark:text-zinc-300 px-0.5 py-1"
        aria-label={`${pct}%`}
      >
        {pct}%
      </button>
      <button
        type="button"
        onClick={onRotate}
        aria-label="rotate"
        className={cn(
          "flex items-center justify-center size-[30px] rounded-full border bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 transition-colors",
          open && "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500",
        )}
      >
        <RotateCw className="size-3.5 text-zinc-600 dark:text-zinc-300" />
      </button>
    </>
  );
}
