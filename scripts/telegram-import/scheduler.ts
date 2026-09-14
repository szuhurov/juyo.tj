/**
 * Long-running process — runs runImport periodically on a cron schedule.
 * Defaults to every 30 minutes (TELEGRAM_CRON_SCHEDULE).
 *
 * Before this, TELEGRAM_SESSION must already be present in .env.local
 * (see login.ts — run it ONCE on your own computer).
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
