/**
 * Orchestration: scraper (HTTP) + parser (HTML→data) → Supabase.
 *
 * Each record has two steps:
 *  1. Upsert into `external_items` (with a (source, external_id) unique
 *     constraint — running it again never creates a duplicate, see the
 *     deduplication journal).
 *  2. If not yet published (published_item_id is empty), also publish it
 *     to the shared `items` table — under the TARGET_USER_ID account (per
 *     the user's explicit request), not a fabricated profile.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "./config";
import { logger } from "./logger";
import { fetchSearchPage, fetchDetailPage } from "./scraper";
import { parseSearchResults, parseDetailPage, guessType } from "./parser";
import type { ImportRow } from "./types";

const SOURCE = "Somon.tj";
// Per the user's explicit request: all imported listings are published to this account.
const TARGET_USER_ID = "user_3GTmOz49mVZU6KeypHzMV14Dx10";

export interface ImportOptions {
  query?: string;
  dryRun?: boolean;
  /** If true, the new listing is also published to items (default: true). */
  publishToFeed?: boolean;
}

export interface ImportResult {
  found: number;
  imported: number;
  published: number;
  failed: number;
}

export function getClient() {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
}

async function collectRows(query: string): Promise<ImportRow[]> {
  const searchHtml = await fetchSearchPage(query);
  const cards = parseSearchResults(searchHtml);
  logger.info(`Карт ёфт шуд`, { count: cards.length });

  const rows: ImportRow[] = [];
  for (const [i, card] of cards.entries()) {
    try {
      const detailHtml = await fetchDetailPage(card.url);
      const detail = parseDetailPage(detailHtml);
      // Some listings don't have a real image — somon.tj shows a dummy
      // icon instead (e.g. /static/images/advert/icon_photo_dummy.svg);
      // we don't count that as a real image.
      const cardImage = card.cardImage && !card.cardImage.includes("icon_photo_dummy") ? card.cardImage : null;
      rows.push({
        external_id: card.externalId,
        source: SOURCE,
        title: detail.title || card.title,
        description: detail.description,
        images: detail.images.length > 0 ? detail.images : cardImage ? [cardImage] : [],
        category: detail.category,
        type: guessType(card.title),
        location: card.location,
        published_at: detail.publishedAt,
        source_url: card.url,
        raw_data: { card, detail: detail.raw },
      });
      logger.info(`[${i + 1}/${cards.length}] parse шуд`, { externalId: card.externalId });
    } catch (err: any) {
      logger.error(`[${i + 1}/${cards.length}] тавсифи эълон гирифта нашуд`, { externalId: card.externalId, error: err.message });
    }
  }
  return rows;
}

// All "паспорт" (passport) search results correspond to the "Documents" category.
function mapCategory(): string {
  return "Documents";
}

// somon.tj serves images with Content-Type: application/octet-stream
// (not image/webp) — Next.js Image treats that as "not an image" and
// rejects it, even though the domain is allowed in remotePatterns. The
// robust fix: mirror the images to our own storage (like real users'
// images), which both solves this problem and removes the dependency on
// the external site.
export async function mirrorImageToStorage(supabase: ReturnType<typeof getClient>, sourceUrl: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, { headers: { "User-Agent": config.userAgent } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = sourceUrl.split(".").pop()?.split("?")[0]?.toLowerCase() || "webp";
    const fileName = `somon-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const contentType = ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "image/jpeg";
    const { error: uploadError } = await supabase.storage.from("items").upload(fileName, buffer, { contentType });
    if (uploadError) throw uploadError;
    const {
      data: { publicUrl },
    } = supabase.storage.from("items").getPublicUrl(fileName);
    return publicUrl;
  } catch (err: any) {
    logger.warn("Аксро ба storage кӯчондан ноком шуд", { sourceUrl, error: err.message });
    return null;
  }
}

async function publishRowToFeed(supabase: ReturnType<typeof getClient>, externalRowId: string, row: ImportRow) {
  const { data: item, error: itemError } = await supabase
    .from("items")
    .insert({
      user_id: TARGET_USER_ID,
      title: row.title,
      description: row.description,
      category: mapCategory(),
      type: row.type ?? "lost",
      phone_number: null,
      date: row.published_at ? row.published_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      is_resolved: false,
      is_guest: false,
      moderation_status: "approved",
      moderation_result: `Imported from ${row.source}`,
    })
    .select("id")
    .single();
  if (itemError) throw itemError;

  if (row.images.length > 0) {
    const mirroredUrls = (await Promise.all(row.images.map((url) => mirrorImageToStorage(supabase, url)))).filter(
      (url): url is string => !!url,
    );
    if (mirroredUrls.length > 0) {
      const { error: imgError } = await supabase
        .from("item_images")
        .insert(mirroredUrls.map((url) => ({ item_id: item.id, image_url: url })));
      if (imgError) logger.warn("item_images навишта нашуд", { itemId: item.id, error: imgError.message });
    }
  }

  const { error: linkError } = await supabase
    .from("external_items")
    .update({ published_item_id: item.id })
    .eq("id", externalRowId);
  if (linkError) logger.warn("published_item_id навишта нашуд", { externalRowId, error: linkError.message });

  return item.id;
}

export async function runImport(options: ImportOptions = {}): Promise<ImportResult> {
  const query = options.query ?? config.defaultQuery;
  const publishToFeed = options.publishToFeed ?? true;
  logger.info(`Воридкунӣ оғоз шуд`, { query, dryRun: !!options.dryRun, publishToFeed });

  const rows = await collectRows(query);
  const result: ImportResult = { found: rows.length, imported: 0, published: 0, failed: 0 };

  if (options.dryRun) {
    logger.info("--dry-run — ба база навишта намешавад", { sample: rows.slice(0, 2) });
    return result;
  }
  if (rows.length === 0) return result;

  const supabase = getClient();

  const { data: upserted, error } = await supabase
    .from("external_items")
    .upsert(rows, { onConflict: "source,source_channel,external_id" })
    .select("id, external_id, source, published_item_id, title, description, category, type, location, published_at, source_url, images");

  if (error) {
    logger.error("Upsert ба external_items ноком шуд", { error: error.message });
    result.failed = rows.length;
    return result;
  }
  result.imported = upserted?.length ?? 0;

  if (publishToFeed && upserted) {
    for (const row of upserted) {
      if (row.published_item_id) continue; // already published — don't publish again
      try {
        await publishRowToFeed(supabase, row.id, row as any);
        result.published++;
      } catch (err: any) {
        logger.error("Нашр ба items ноком шуд", { externalId: row.external_id, error: err.message });
        result.failed++;
      }
    }
  }

  logger.info("Воридкунӣ тамом шуд", result as any);
  return result;
}
