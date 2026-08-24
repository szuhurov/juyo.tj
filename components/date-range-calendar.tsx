/**
 * Календари интихоби бозаи сана (Аз/То) — филтри саҳифаи асосӣ.
 *
 * Пештар ин ҷо `<input type="date">`-и браузерӣ буд, вале дар баъзе
 * браузерҳои мобилӣ ҳангоми зеркунӣ picker-и воқеӣ намебаромад (талаби
 * корбар). Барои рафтори якхела дар ҳама ҷо ва мутобиқат бо намуди
 * барномаи native, ин ҷо шабакаи моҳи худсохта аст (date-fns барои
 * ҳисоби рӯзҳо, бе китобхонаи иловагӣ).
 *
 * Номҳои моҳ/рӯзи ҳафта дар ин ҷо алоҳида нигоҳ дошта мешаванд (на дар
 * `t()`-и умумӣ) — мисли `lib/date-locales.ts`, ки барои маҳз ҳамин сабаб
 * локали тоҷикии худро алоҳида месозад.
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
  parseISO,
  isValid,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";

/**
 * "👈"/"👉" на SVG-анд: барномаи лоиҳа аллакай эмоҷиро ҳамчун нишона
 * истифода мебарад (масалан `CATEGORIES` дар item-service.ts), пас ин ҷо
 * низ китобхонаи нави icon лозим нест.
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
  /** yyyy-MM-dd, ё холӣ */
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

  // Нуқтае, ки зеркунии рӯзи навбатӣ ба он мерасад — ниг. `handleDayClick`.
  // Ҳамин мантиқ дар ин ҷо низ такрор мешавад, то "Аз"/"То" дуруст сабз шавад.
  const target: "from" | "to" = !fromDate || (fromDate && toDate) ? "from" : "to";

  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(fromDate ?? new Date()),
  );

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 }),
  });

  const handleDayClick = (day: Date) => {
    // На нуқтаи ибтидо ҳаст, на охир — ё ҳарду аллакай интихоб шудаанд:
    // интихоби нав аз сар мешавад.
    if (!fromDate || (fromDate && toDate)) {
      onChange({ from: format(day, "yyyy-MM-dd"), to: undefined });
      return;
    }
    // Агар рӯзи зершуда пеш аз "Аз" бошад, ҳамчун ибтидои нав мегирем.
    if (isBefore(day, fromDate)) {
      onChange({ from: format(day, "yyyy-MM-dd"), to: undefined });
      return;
    }
    onChange({ from, to: format(day, "yyyy-MM-dd") });
  };

  const dateFormatHint = DATE_FORMAT_HINT[locale] ?? DATE_FORMAT_HINT.en;
  // Ҳарду аллакай интихобшуда — ишора дигар лозим нест (талаби корбар).
  const isComplete = Boolean(fromDate && toDate);

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div>
          <span className="block text-[10px] font-bold tracking-wider uppercase text-zinc-400">
            {t("dateFrom")}
          </span>
          <span
            className={cn(
              "text-xs font-bold",
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

        {/* Як ишора, на ду — самташ вобаста ба он ки навбат ба кадомаш аст.
            Агар ҳарду аллакай интихобшуда бошанд, ишора нест мешавад. */}
        {!isComplete && (
          <span aria-hidden className="text-xl">
            {target === "from" ? "👈" : "👉"}
          </span>
        )}

        <div className="text-right">
          <span className="block text-[10px] font-bold tracking-wider uppercase text-zinc-400">
            {t("dateTo")}
          </span>
          <span
            className={cn(
              "text-xs font-bold",
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
          className="h-7 w-7 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
          {months[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          aria-label="Next month"
          className="h-7 w-7 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {weekdays.map((d) => (
          <span key={d} className="text-center text-[10px] font-bold text-zinc-400">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth);
          const isFrom = fromDate ? isSameDay(day, fromDate) : false;
          const isTo = toDate ? isSameDay(day, toDate) : false;
          const inRange =
            fromDate && toDate && !isFrom && !isTo
              ? isWithinInterval(day, { start: fromDate, end: toDate })
              : false;

          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              disabled={!inMonth}
              className={cn(
                "h-8 text-xs font-semibold rounded-lg cursor-pointer transition-colors",
                !inMonth && "text-transparent cursor-default pointer-events-none",
                inMonth && !isFrom && !isTo && !inRange &&
                  "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700",
                inRange && "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-none",
                (isFrom || isTo) && "bg-emerald-500 text-white",
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
