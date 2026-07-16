/**
 * Раванди тӯлонӣ (long-running) — runImport-ро аз рӯи cron ба таври
 * даврӣ иҷро мекунад. Пешфарз ҳар 6 соат (на ҳар 15 дақиқа), то
 * баррасии дастии admin (пур кардани рақами телефон) ба вақт расад —
 * ниг. SOMON_CRON_SCHEDULE дар config.ts барои тағир додан.
 *
 * Истифода (бояд иҷрокунанда доимӣ кушода бимонад — pm2/systemd/Task
 * Scheduler ё монанди он):
 *   node --env-file=.env.local -r tsx/cjs scripts/somon-import/scheduler.ts
 *   ё: npx tsx --env-file=.env.local scripts/somon-import/scheduler.ts
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
    // Ҳаргиз набояд аз ин ҷо баромада бирасад — раванди cron бояд зинда монад.
    logger.error("Давраи cron бо хатогӣ тамом шуд, зинда мемонем", { error: err.message });
  } finally {
    running = false;
  }
}

logger.info("Scheduler оғоз шуд", { schedule: config.cronSchedule });
cron.schedule(config.cronSchedule, tick);

// Бори аввал фавран иҷро мекунем, баъд аз рӯи cron.
tick();

process.on("SIGINT", () => {
  logger.info("Scheduler бас карда шуд (SIGINT)");
  process.exit(0);
});
