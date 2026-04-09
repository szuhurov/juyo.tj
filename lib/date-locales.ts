import { ru, enUS } from "date-fns/locale";

// Омода кардани локали оддии тоҷикӣ барои date-fns
const tgLocale: any = {
  code: 'tg',
  formatDistance: (token: string, count: number, options: any) => {
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
