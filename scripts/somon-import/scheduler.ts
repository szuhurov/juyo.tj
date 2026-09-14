/**
 * A long-running process — runs runImport periodically on a cron
 * schedule. Defaults to every 6 hours (not every 15 minutes), to give
 * time for the admin's manual review (filling in the phone number) —
 * see SOMON_CRON_SCHEDULE in config.ts to change it.
 *
 * Usage (the process must stay open continuously — pm2/systemd/Task
 * Scheduler or similar):
 *   node --env-file=.env.local -r tsx/cjs scripts/somon-import/scheduler.ts
 *   or: npx tsx --env-file=.env.local scripts/somon-import/scheduler.ts
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
    // This must never escape from here — the cron process must stay alive.
    logger.error("Давраи cron бо хатогӣ тамом шуд, зинда мемонем", { error: err.message });
  } finally {
    running = false;
  }
}

logger.info("Scheduler оғоз шуд", { schedule: config.cronSchedule });
cron.schedule(config.cronSchedule, tick);

// The first run happens immediately, after that it follows the cron schedule.
tick();

process.on("SIGINT", () => {
  logger.info("Scheduler бас карда шуд (SIGINT)");
  process.exit(0);
});
