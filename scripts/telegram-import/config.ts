/**
 * Танзимот барои воридкунандаи Telegram — тавассути env vars (--env-file=.env.local).
 */
import { existsSync, readFileSync } from "fs";

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
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",

  // https://my.telegram.org/apps — app-и худатон (рӯйхати роҳнамо дар README).
  telegramApiId: Number(process.env.TELEGRAM_API_ID ?? 0),
  telegramApiHash: process.env.TELEGRAM_API_HASH ?? "",
  /** login.ts як бор дар компютери шумо иҷро мешавад, ин қиматро мебарорад — баъд ба .env.local гузоред. */
  telegramSession: process.env.TELEGRAM_SESSION ?? "",

  channels: (process.env.TELEGRAM_CHANNELS ?? "poteryashki_tj")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean),

  /** Ба ҳар канал чанд паёми охирин дар як run санҷида шавад (бори аввал/фосилаи дуру дароз). */
  messagesPerChannel: Number(process.env.TELEGRAM_MESSAGES_PER_RUN ?? 500),

  /** Пешфарз ҳар 30 дақиқа — Telegram паёмҳои нав тезтар аз somon.tj пайдо мешаванд. */
  cronSchedule: process.env.TELEGRAM_CRON_SCHEDULE ?? "*/30 * * * *",

  /** Танҳо агар AI бо ин дараҷаи боварӣ ё зиёдтар ҷавоб дод, категория/навъро эътимод мекунем (вагарна "Other"/null мемонад, барои баррасии дастӣ). */
  minConfidence: Number(process.env.TELEGRAM_MIN_CONFIDENCE ?? 0.6),
};
