/**
 * One-off run from the terminal (not cron) — for testing or manual import.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/somon-import/run-once.ts
 *   npx tsx --env-file=.env.local scripts/somon-import/run-once.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/somon-import/run-once.ts --query "ёфтшуда"
 *   npx tsx --env-file=.env.local scripts/somon-import/run-once.ts --no-publish
 */
import { runImport } from "./importer";
import { logger } from "./logger";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const noPublish = args.includes("--no-publish");
const queryIdx = args.indexOf("--query");
const query = queryIdx !== -1 ? args[queryIdx + 1] : undefined;

runImport({ query, dryRun, publishToFeed: !noPublish })
  .then((result) => {
    logger.info("Натиҷаи ниҳоӣ", result as any);
    process.exit(0);
  })
  .catch((err) => {
    logger.error("Хатогии ниҳоӣ", { error: err.message });
    process.exit(1);
  });
