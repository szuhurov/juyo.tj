/**
 * Созгузории забонҳо барои китобхонаи date-fns.
 * Барои дуруст нишон додани сана ва вақт бо забонҳои гуногун.
 */
import { ru, enUS, type Locale } from "date-fns/locale"; // Барои забонҳои русиву англисӣ

// Омода кардани локали оддии тоҷикӣ барои date-fns. Танҳо `formatDistance`
// амалан истифода мешавад (аз ин рӯ на ҳамаи хосиятҳои Locale пур карда
// шудаанд) — Partial<Locale> инро дуруст ифода мекунад, на `any`.
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
  // Илова кардани дигар хосиятҳои лозимӣ агар лозим бошад
};

export const getDateLocale = (locale: string) => {
  if (locale === 'tg') return tgLocale;
  if (locale === 'ru') return ru;
  return enUS;
};
