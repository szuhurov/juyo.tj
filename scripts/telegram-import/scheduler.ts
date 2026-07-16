/**
 * Раванди тӯлонӣ (long-running) — runImport-ро аз рӯи cron ба таври
 * даврӣ иҷро мекунад. Пешфарз ҳар 30 дақиқа (TELEGRAM_CRON_SCHEDULE).
 *
 * Пеш аз ин, TELEGRAM_SESSION бояд аллакай дар .env.local бошад
 * (ниг. login.ts — ЯКДАФЪАИНА дар компютери худ иҷро кунед).
 */
import cron from "node-cron";
import { config } from "./config";
import { logger } from "./logger";
import { runImport } from "./importer";

let running = false;

async function tick() {
  if (running) {
    logger.warn("Иҷрои қаблӣ ҳанӯз тамом нашудааст — ин давра гузаронда мешавад.");
    return;
  }
  running = true;
  try {
    await runImport();
  } catch (err: any) {
    logger.error("Давраи cron бо хатогӣ тамом шуд, зинда мемонем", { error: err.message });
  } finally {
    running = false;
  }
}

logger.info("Telegram scheduler оғоз шуд", { schedule: config.cronSchedule, channels: config.channels });
cron.schedule(config.cronSchedule, tick);
tick();

process.on("SIGINT", () => {
  logger.info("Scheduler бас карда шуд (SIGINT)");
  process.exit(0);
});
