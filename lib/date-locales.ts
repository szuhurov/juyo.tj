/**
 * Locale setup for the date-fns library.
 * For correctly displaying dates and times in different languages.
 */
import { ru, enUS, type Locale } from "date-fns/locale"; // For Russian and English

// Preparing a simple Tajik locale for date-fns. Only `formatDistance` is
// actually used (which is why not all Locale properties are filled in) —
// Partial<Locale> expresses this correctly, instead of `any`.
const tgLocale: Partial<Locale> = {
  code: 'tg',
  formatDistance: (token, count) => {
    const format: Record<string, string> = {
      lessThanXSeconds: 'ҳозир',
      xSeconds: 'ҳозир',
      halfAMinute: 'ним дақиқа пеш',
      lessThanXMinutes: '%{count} дақиқа пеш',
      xMinutes: '%{count} дақиқа пеш',
      aboutXHours: '%{count} соат пеш',
      xHours: '%{count} соат пеш',
      xDays: '%{count} рӯз пеш',
      aboutXMonths: '%{count} моҳ пеш',
      xMonths: '%{count} моҳ пеш',
      aboutXYears: '%{count} сол пеш',
      xYears: '%{count} сол пеш',
      overXYears: '%{count} сол пеш',
      almostXYears: '%{count} сол пеш',
    };

    const result = format[token] || format.xMinutes;
    return result.replace('%{count}', count.toString());
  },
  // Add other necessary properties if needed
};

export const getDateLocale = (locale: string) => {
  if (locale === 'tg') return tgLocale;
  if (locale === 'ru') return ru;
  return enUS;
};
