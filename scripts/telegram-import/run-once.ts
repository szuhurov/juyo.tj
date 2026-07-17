/**
 * Иҷрои якдафъаина аз терминал.
 *
 * Истифода:
 *   npx tsx --env-file=.env.local scripts/telegram-import/run-once.ts
 *   npx tsx --env-file=.env.local scripts/telegram-import/run-once.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/telegram-import/run-once.ts --older --limit=600
 */
import { runImport } from "./importer";
import { logger } from "./logger";

const dryRun = process.argv.includes("--dry-run");
const direction = process.argv.includes("--older") ? "older" : "newer";
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

runImport({ dryRun, direction, limit })
  .then((result) => {
    logger.info("Натиҷаи ниҳоӣ", result as any);
    process.exit(0);
  })
  .catch((err) => {
    logger.error("Хатогии ниҳоӣ", { error: err.message });
    process.exit(1);
  });
