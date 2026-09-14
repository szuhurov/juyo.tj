/**
 * Configuration for the Telegram importer — via env vars (--env-file=.env.local).
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

  // https://my.telegram.org/apps — your own app (setup guide in the README).
  telegramApiId: Number(process.env.TELEGRAM_API_ID ?? 0),
  telegramApiHash: process.env.TELEGRAM_API_HASH ?? "",
  /** login.ts is run once on your computer, it outputs this value — then put it into .env.local. */
  telegramSession: process.env.TELEGRAM_SESSION ?? "",

  channels: (process.env.TELEGRAM_CHANNELS ?? "poteryashki_tj")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean),

  /** How many of the most recent messages per channel to check in one run (first run / long gap between runs). */
  messagesPerChannel: Number(process.env.TELEGRAM_MESSAGES_PER_RUN ?? 500),

  /** Defaults to every 30 minutes — new Telegram messages appear faster than on somon.tj. */
  cronSchedule: process.env.TELEGRAM_CRON_SCHEDULE ?? "*/30 * * * *",

  /** We only trust the category/type if the AI responded with this confidence level or higher (otherwise it stays "Other"/null, for manual review). */
  minConfidence: Number(process.env.TELEGRAM_MIN_CONFIDENCE ?? 0.6),
};
