/**
 * Slider for the SPLIT percentage of two gradient colors (bias) — web version.
 *
 * The native version of this component (`components/PercentSlider.tsx`)
 * uses `react-native-gesture-handler`, because React Native has no
 * BUILT-IN slider. The web doesn't need this — the browser already
 * handles dragging a `<input type="range">` (mouse and touch, no custom
 * gesture logic needed). This simplification is deliberate: the visual
 * result and functional behavior (track/fill/thumb, min/max, change) are the same.
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

/**
 * Rotate button. User request (the same fix native already has — see
 * the `GradientBiasToggle` comment on mobile): the % number was
 * redundant — the slider itself (PercentSlider above) already shows
 * that percentage, so it was removed here.
 */
export function GradientBiasToggle({
  onRotate,
}: {
  onRotate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRotate}
      aria-label="rotate"
      className="ml-auto flex items-center justify-center size-[30px] rounded-full border bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 transition-colors"
    >
      <RotateCw className="size-3.5 text-zinc-600 dark:text-zinc-300" />
    </button>
  );
}
