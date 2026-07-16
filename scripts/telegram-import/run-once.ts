/**
 * Иҷрои якдафъаина аз терминал.
 *
 * Истифода:
 *   npx tsx --env-file=.env.local scripts/telegram-import/run-once.ts
 *   npx tsx --env-file=.env.local scripts/telegram-import/run-once.ts --dry-run
 */
import { runImport } from "./importer";
import { logger } from "./logger";

const dryRun = process.argv.includes("--dry-run");

runImport({ dryRun })
  .then((result) => {
    logger.info("Натиҷаи ниҳоӣ", result as any);
    process.exit(0);
  })
  .catch((err) => {
    logger.error("Хатогии ниҳоӣ", { error: err.message });
    process.exit(1);
  });
