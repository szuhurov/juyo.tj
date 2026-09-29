"use client";

/**
 * Web port of the mobile app's `components/VisualSearchScanUI.tsx` — same
 * layout: progress ring around the dimmed photo with twinkling sparkles, a
 * percentage, a caption and a step checklist. Used by visual search and by
 * the AI check step of items/add. If one changes, change the other.
 *
 * Cosmetic only: the real AI call runs independently and this component is
 * unmounted when results arrive, so progress eases toward ~92% and holds.
 */
import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { CheckCircle2, Circle, Sparkle } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";

const STEP_DELAYS = [0, 900, 2000, 3400];

// Ring geometry in viewBox units (0–100); the app uses a 7px stroke on a ~320px ring.
const STROKE = 2.2;
const RADIUS = (100 - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Photo = ring minus both strokes minus a 14px gap (app: RING - STROKE*2 - 14).
const PHOTO_PCT = 91;

const STARS = [
  { angle: -50, dist: 0.62, size: 18, color: "text-emerald-400", phase: 0 },
  { angle: 8, dist: 0.78, size: 12, color: "text-amber-400", phase: 0.35 },
  { angle: 70, dist: 0.55, size: 16, color: "text-sky-500", phase: 0.62 },
  { angle: 130, dist: 0.74, size: 11, color: "text-violet-500", phase: 0.15 },
  { angle: 190, dist: 0.6, size: 17, color: "text-emerald-500", phase: 0.5 },
  { angle: 245, dist: 0.72, size: 13, color: "text-amber-400", phase: 0.8 },
  { angle: 305, dist: 0.4, size: 11, color: "text-rose-500", phase: 0.28 },
  { angle: 20, dist: 0.25, size: 10, color: "text-sky-500", phase: 0.9 },
] as const;

interface Props {
  photoUrl: string | null;
  /** CSS size of the ring; defaults to almost the viewport width (max 320px). */
  size?: string;
  /** Checklist labels; defaults to the visual-search steps. */
  stepLabels?: string[];
  /** ms at which each step becomes active (same length as stepLabels). */
  stepDelays?: number[];
  /** Text under the percentage; defaults to "AI is searching...". */
  caption?: string;
  /** Extra content under the checklist (e.g. a timer). */
  footer?: ReactNode;
}

export function VisualSearchScanUI({ photoUrl, size, stepLabels, stepDelays, caption, footer }: Props) {
  const { t } = useLanguage();
  const steps = stepLabels ?? [t("vsStepReceived"), t("vsStepDetecting"), t("vsStepAnalyzing"), t("vsStepMatching")];
  const delays = stepDelays ?? STEP_DELAYS;
  const targets = steps.map((_, i) => Math.round(18 + (74 * i) / Math.max(steps.length - 1, 1)));
  const [stepIndex, setStepIndex] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const timers = delays.slice(0, steps.length).map((delay, i) =>
      setTimeout(() => {
        setStepIndex(i);
        setPct(targets[i]);
      }, delay),
    );
    return () => timers.forEach(clearTimeout);
    // Runs once per mount, like the app (labels/targets are fixed for a scan).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringSize = size ?? "min(calc(100vw - 56px), 320px)";

  return (
    <div className="flex flex-col items-center">
      <div className="relative grid place-items-center" style={{ width: ringSize, height: ringSize }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-emerald-100 dark:stroke-emerald-950" />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - pct / 100)}
            className="stroke-emerald-500 transition-[stroke-dashoffset] duration-[800ms] ease-out motion-reduce:transition-none"
          />
        </svg>

        <div
          className="relative overflow-hidden rounded-full bg-zinc-900"
          style={{ width: `${PHOTO_PCT}%`, height: `${PHOTO_PCT}%` }}
        >
          {photoUrl && <Image src={photoUrl} alt="" fill sizes="320px" className="object-cover" unoptimized />}
          <div className="absolute inset-0 bg-black/60" aria-hidden />
        </div>

        {STARS.map((st, i) => {
          const rad = (st.angle * Math.PI) / 180;
          const r = (PHOTO_PCT / 2) * st.dist;
          return (
            <Sparkle
              key={i}
              aria-hidden
              className={cn("absolute juyo-twinkle fill-current drop-shadow-[0_0_6px_currentColor]", st.color)}
              style={{
                width: st.size,
                height: st.size,
                left: `calc(${50 + Math.cos(rad) * r}% - ${st.size / 2}px)`,
                top: `calc(${50 + Math.sin(rad) * r}% - ${st.size / 2}px)`,
                animationDelay: `${-st.phase * 2.2}s`,
              }}
            />
          );
        })}
      </div>

      <p className="mt-[18px] text-3xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{pct}%</p>
      <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 text-center">
        {caption ?? t("visualSearching")}
      </p>

      <div className="mt-6 flex flex-col gap-4 pl-3 text-left max-w-full" style={{ width: `max(${ringSize}, 240px)` }}>
        {steps.map((label, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <div key={i} className="flex items-center gap-3.5">
              <span className="grid size-6 place-items-center shrink-0">
                {done ? (
                  <CheckCircle2 className="size-[22px] text-emerald-500" />
                ) : active ? (
                  <span className="size-5 rounded-full bg-emerald-500 juyo-pulse-dot" />
                ) : (
                  <Circle className="size-[22px] text-zinc-300 dark:text-zinc-600" />
                )}
              </span>
              <span
                className={cn(
                  "text-sm font-medium text-zinc-400",
                  (done || active) && "text-zinc-700 dark:text-zinc-300",
                  active && "font-bold text-zinc-900 dark:text-zinc-100",
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
