/**
 * Танзимот барои воридкунандаи somon.tj — тавассути env vars (--env-file=.env.local).
 */
import { existsSync, readFileSync } from "fs";

// --env-file аллакай .env.local-ро бор мекунад; агар набошад (масалан
// скрипт бе он иҷро шуда бошад), худамон дастӣ мехонем.
function loadDotEnvFallback() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const path = ".env.local";
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadDotEnvFallback();

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env variable ${name} нест — .env.local-ро санҷед (node --env-file=.env.local ...).`);
  return v;
}

export const config = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  /** somon.tj-ро эҳтиром мекунем — дархостҳоро паси ҳам мефиристем, на якбора. */
  requestDelayMs: Number(process.env.SOMON_REQUEST_DELAY_MS ?? 800),
  /** Cron: пешфарз ҳар 6 соат (на ҳар 15 дақиқа) — то баррасии дастии admin (телефон) ба вақт расад. */
  cronSchedule: process.env.SOMON_CRON_SCHEDULE ?? "0 */6 * * *",
  defaultQuery: process.env.SOMON_SEARCH_QUERY ?? "паспорт",
  searchBaseUrl: process.env.SOMON_SEARCH_URL ?? "https://somon.tj/search/dushanbe/",
  userAgent:
    "Mozilla/5.0 (compatible; JuyoTjImportBot/1.0; +https://juyo.tj) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};
