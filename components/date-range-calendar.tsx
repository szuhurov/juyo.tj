/**
 * Date range picker calendar (From/To) — main page filter.
 *
 * This used to be a browser `<input type="date">`, but on some mobile
 * browsers tapping it didn't bring up the actual picker (user complaint).
 * For consistent behavior everywhere and to match the look of a native
 * app, this is a custom-built month grid instead (date-fns is used only
 * for date calculations, no extra library).
 *
 * Month/weekday names are kept separately here (not in the shared `t()`)
 * — similar to `lib/date-locales.ts`, which builds its own Tajik locale
 * for exactly this same reason.
 */
"use client";

import { useState } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  isBefore,
  isAfter,
  startOfDay,
  parseISO,
  isValid,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";

/**
 * "👈"/"👉" instead of SVGs: the project already uses emoji as icons
 * elsewhere (e.g. `CATEGORIES` in item-service.ts), so there's no need
 * for a new icon library here either.
 */
const DATE_FORMAT_HINT: Record<string, string> = {
  tg: "рр.мм.сссс",
  ru: "дд.мм.гггг",
  en: "dd.mm.yyyy",
};

const MONTH_NAMES: Record<string, string[]> = {
  tg: ["Январ", "Феврал", "Март", "Апрел", "Май", "Июн", "Июл", "Август", "Сентябр", "Октябр", "Ноябр", "Декабр"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

const WEEKDAY_NAMES: Record<string, string[]> = {
  tg: ["Дш", "Сш", "Чш", "Пш", "Ҷм", "Шб", "Яш"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
};

interface DateRangeCalendarProps {
  /** yyyy-MM-dd, or empty */
  from?: string;
  to?: string;
  onChange: (next: { from?: string; to?: string }) => void;
}

export function DateRangeCalendar({ from, to, onChange }: DateRangeCalendarProps) {
  const { t, locale } = useLanguage();
  const months = MONTH_NAMES[locale] ?? MONTH_NAMES.en;
  const weekdays = WEEKDAY_NAMES[locale] ?? WEEKDAY_NAMES.en;

  const fromDate = from && isValid(parseISO(from)) ? parseISO(from) : undefined;
  const toDate = to && isValid(parseISO(to)) ? parseISO(to) : undefined;

  // Which point the next day-click will set — see `handleDayClick`.
  // The same logic is repeated here so "From"/"To" highlight correctly.
  // "To" is filled with today right after the first click, so whether the user
  // has actually chosen it is tracked separately: the next click after that
  // starts a fresh selection.
  const [toPicked, setToPicked] = useState(Boolean(fromDate && toDate));
  const isComplete = toPicked && Boolean(fromDate && toDate);
  const target: "from" | "to" = !fromDate || isComplete ? "from" : "to";

  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(fromDate ?? new Date()),
  );

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 }),
  });

  const today = startOfDay(new Date());
  const todayStr = format(today, "yyyy-MM-dd");

  const handleDayClick = (day: Date) => {
    // Days that haven't happened yet can't hold listings — never selectable.
    if (isAfter(day, today)) return;
    const dayStr = format(day, "yyyy-MM-dd");
    // First pick (or a new round after "To" was chosen): it becomes "From",
    // and "To" defaults to today.
    if (!fromDate || isComplete) {
      setToPicked(false);
      onChange({ from: dayStr, to: todayStr });
      return;
    }
    // Before "From": move the start, keep the end.
    if (isBefore(day, fromDate)) {
      onChange({ from: dayStr, to: to || todayStr });
      return;
    }
    // Otherwise choose "To" (already limited to today at the latest).
    setToPicked(true);
    onChange({ from, to: dayStr });
  };

  const dateFormatHint = DATE_FORMAT_HINT[locale] ?? DATE_FORMAT_HINT.en;

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div>
          <span className="block text-[10px] font-medium tracking-wider uppercase text-slate-400">
            {t("dateFrom")}
          </span>
          <span
            className={cn(
              "text-xs font-medium",
              from
                ? !isComplete && target === "from"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-700 dark:text-zinc-200"
                : "text-zinc-300 dark:text-zinc-600",
            )}
          >
            {from ? format(parseISO(from), "dd.MM.yyyy") : dateFormatHint}
          </span>
        </div>

        {/* One hint, not two — its direction depends on which one is next.
            If both are already selected, the hint disappears. */}
        {!isComplete && (
          <span aria-hidden className="text-xl">
            {target === "from" ? "👈" : "👉"}
          </span>
        )}

        <div className="text-right">
          <span className="block text-[10px] font-medium tracking-wider uppercase text-slate-400">
            {t("dateTo")}
          </span>
          <span
            className={cn(
              "text-xs font-medium",
              to
                ? !isComplete && target === "to"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-700 dark:text-zinc-200"
                : "text-zinc-300 dark:text-zinc-600",
            )}
          >
            {to ? format(parseISO(to), "dd.MM.yyyy") : dateFormatHint}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          aria-label="Previous month"
          className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
          {months[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          disabled={!isBefore(viewMonth, startOfMonth(today))}
          aria-label="Next month"
          className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {weekdays.map((d) => (
          <span key={d} className="text-center text-[10px] font-medium text-slate-400">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth);
          const isFrom = fromDate ? isSameDay(day, fromDate) : false;
          const isTo = toDate ? isSameDay(day, toDate) : false;
          const isToday = isSameDay(day, today);
          const isFuture = isAfter(day, today);
          const inRange =
            fromDate && toDate && !isFrom && !isTo
              ? isWithinInterval(day, { start: fromDate, end: toDate })
              : false;

          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              disabled={!inMonth || isFuture}
              className={cn(
                "h-8 text-xs font-medium rounded-md cursor-pointer transition-colors",
                !inMonth && "text-transparent cursor-default pointer-events-none",
                inMonth && isFuture && "text-zinc-300 dark:text-zinc-600 cursor-not-allowed",
                inMonth && !isFuture && !isFrom && !isTo && !inRange &&
                  "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700",
                inRange && "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-none",
                (isFrom || isTo) && "bg-emerald-500 text-white",
                isToday && !isFrom && !isTo && !inRange && "bg-zinc-200 dark:bg-zinc-700",
              )}
            >
              {inMonth ? day.getDate() : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
