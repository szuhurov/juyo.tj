/**
 * Якдафъаина: аксҳои эълонҳои аллакай нашршударо (ки то ҳол ба URL-и
 * somon.tj ишора мекунанд — image/octet-stream, дар Next.js Image кор
 * намекунад) ба storage-и худамон мекӯчонад ва item_images-ро нав мекунад.
 *
 * Истифода: npx tsx --env-file=.env.local scripts/somon-import/backfill-images.ts
 */
import { getClient, mirrorImageToStorage } from "./importer";
import { logger } from "./logger";

async function main() {
  const supabase = getClient();

  const { data: rows, error } = await supabase
    .from("item_images")
    .select("id, item_id, image_url")
    .like("image_url", "https://files.somon.tj/%");
  if (error) throw error;
  if (!rows || rows.length === 0) {
    logger.info("Ягон акси somon.tj барои ислоҳ нест.");
    return;
  }
  logger.info(`Ислоҳи аксҳо оғоз шуд`, { count: rows.length });

  let fixed = 0;
  let failed = 0;
  for (const [i, row] of rows.entries()) {
    const newUrl = await mirrorImageToStorage(supabase, row.image_url);
    if (!newUrl) {
      failed++;
      logger.warn(`[${i + 1}/${rows.length}] кӯчондан ноком шуд`, { id: row.id });
      continue;
    }
    const { error: updateError } = await supabase.from("item_images").update({ image_url: newUrl }).eq("id", row.id);
    if (updateError) {
      failed++;
      logger.warn(`[${i + 1}/${rows.length}] навиштан ноком шуд`, { id: row.id, error: updateError.message });
      continue;
    }
    fixed++;
    logger.info(`[${i + 1}/${rows.length}] ислоҳ шуд`, { id: row.id });
  }

  logger.info("Тамом шуд", { fixed, failed });
}

main().catch((err) => {
  logger.error("Хатогии ниҳоӣ", { error: err.message });
  process.exit(1);
});
