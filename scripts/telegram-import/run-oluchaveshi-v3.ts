/**
 * Third (final) import from t.me/oluchaveshi, on behalf of Ali Mirzoev
 * (allimirzoev2000@icloud.com, with his consent). OpenAI credit was added —
 * now both AI classification and AI moderation actually work.
 *
 * Rules (per admin's request):
 *  - description: original post text UNCHANGED
 *  - title: AI-generated from text AND image — 1-2 words
 *  - type (lost/found): AI determines it; if it can't — defaults to "found"
 *  - category: AI chooses it
 *  - date: the post's ACTUAL date on Telegram (not the import time)
 *  - phone: fixed at 111212331
 *  - reward: if mentioned — the amount (if known) or general text
 *    (if unknown); otherwise empty
 *  - posts that are "already resolved" and posts unrelated to lost/found
 *    (low confidence) are dropped — not recorded
 *  - moderation: REAL (pending → trigger → AI) — Ali's moderation_exempt is
 *    temporarily disabled
 *  - goal: 92 new successful listings (the app already has 8 listings, to reach 100)
 *
 * Run: node --env-file=.env.local --import tsx scripts/telegram-import/run-oluchaveshi-v3.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "./config";
import { logger } from "./logger";
import { fetchChannelPosts, disconnectListener, type TelegramPost } from "./listener";
import { classifyPost, type Classification } from "./classifier";

const SOURCE = "Telegram";
const CHANNEL = "oluchaveshi";
const TARGET_USER_ID = "user_3H0PTIOzFRgmfVuBGBrKYR6RcFO"; // Ali Mirzoev
const FIXED_PHONE = "111212331";
const TARGET_NEW = 92;
const FETCH_LIMIT = 100; // only the last 100 posts (per admin's request)
const MIN_CONFIDENCE = 0.6;
const BATCH_SIZE = 8;
const BATCH_DELAY_MS = 4000;
const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 15 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getClient() {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
}

async function uploadImage(supabase: ReturnType<typeof getClient>, buffer: Buffer): Promise<string | null> {
  try {
    const fileName = `telegram-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await supabase.storage.from("items").upload(fileName, buffer, { contentType: "image/jpeg" });
    if (error) throw error;
    const {
      data: { publicUrl },
    } = supabase.storage.from("items").getPublicUrl(fileName);
    return publicUrl;
  } catch (err: any) {
    logger.warn("Боркунии акс ноком шуд", { error: err.message });
    return null;
  }
}

async function insertItem(
  supabase: ReturnType<typeof getClient>,
  post: TelegramPost,
  classification: Classification,
  imageUrl: string | null,
): Promise<string> {
  const { data: item, error: itemError } = await supabase
    .from("items")
    .insert({
      user_id: TARGET_USER_ID,
      title: classification.title,
      description: post.text,
      category: classification.category,
      type: classification.status ?? "found", // if AI couldn't determine it — default to "found"
      phone_number: FIXED_PHONE,
      reward: classification.reward,
      date: post.date.slice(0, 10), // actual Telegram date, not the import time
      is_resolved: false,
      is_guest: false,
      moderation_status: "pending", // goes through REAL review
    })
    .select("id")
    .single();
  if (itemError) throw itemError;

  if (imageUrl) {
    const { error: imgError } = await supabase.from("item_images").insert({ item_id: item.id, image_url: imageUrl });
    if (imgError) logger.warn("item_images навишта нашуд", { itemId: item.id, error: imgError.message });
  }

  await supabase.from("external_items").upsert(
    {
      source: SOURCE,
      source_channel: post.channel,
      external_id: String(post.messageId),
      telegram_message_id: post.messageId,
      title: classification.title,
      description: post.text,
      images: imageUrl ? [imageUrl] : [],
      category: classification.category,
      type: classification.status ?? "found",
      location: classification.city,
      published_at: post.date,
      source_url: post.postUrl,
      raw_data: { text: post.text, classification },
      phone_number: FIXED_PHONE,
      ai_confidence: classification.confidence,
      published_item_id: item.id,
    },
    { onConflict: "source,source_channel,external_id" },
  );

  return item.id;
}

async function main() {
  const supabase = getClient();

  // 1. Temporarily disable the bypass so moderation actually runs.
  await supabase.from("profiles").update({ moderation_exempt: false }).eq("id", TARGET_USER_ID);
  logger.info("moderation_exempt муваққатан хомӯш карда шуд.");

  // 2. Fetch a pool of recent posts (newest to oldest).
  const posts = await fetchChannelPosts(CHANNEL, FETCH_LIMIT);
  logger.info("Паём ёфт шуд", { channel: CHANNEL, count: posts.length });

  const insertedIds: string[] = [];
  let skippedResolved = 0;
  let skippedLowConfidence = 0;
  let failed = 0;

  // 3. Process in small batches until the count reaches TARGET_NEW.
  for (let i = 0; i < posts.length && insertedIds.length < TARGET_NEW; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    for (const post of batch) {
      if (insertedIds.length >= TARGET_NEW) break;
      try {
        const imageBase64 = post.imageBuffer ? post.imageBuffer.toString("base64") : undefined;
        const classification = await classifyPost(post.text, imageBase64);

        if (classification.already_resolved) {
          skippedResolved++;
          continue;
        }
        if (classification.confidence < MIN_CONFIDENCE) {
          skippedLowConfidence++;
          continue;
        }

        const imageUrl = post.imageBuffer ? await uploadImage(supabase, post.imageBuffer) : null;
        const itemId = await insertItem(supabase, post, classification, imageUrl);
        insertedIds.push(itemId);
      } catch (err: any) {
        failed++;
        logger.error("Коркарди паём ноком шуд", { messageId: post.messageId, error: err.message });
      }
    }
    logger.info(`Партияи ${i / BATCH_SIZE + 1} коркард шуд`, {
      inserted: insertedIds.length,
      skippedResolved,
      skippedLowConfidence,
      failed,
    });
    await sleep(BATCH_DELAY_MS);
  }

  await disconnectListener();
  logger.info("Воридкунӣ тамом шуд", { imported: insertedIds.length, skippedResolved, skippedLowConfidence, failed });

  // 4. Wait for real moderation to finish.
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    const { data: pending } = await supabase
      .from("items")
      .select("id")
      .in("id", insertedIds)
      .eq("moderation_status", "pending");
    const remaining = pending?.length ?? 0;
    logger.info(`Ҳанӯз дар интизор: ${remaining}`);
    if (remaining === 0) break;
    await sleep(POLL_INTERVAL_MS);
  }

  // 5. Restore the bypass for Ali's future listings (submitted through the normal wizard).
  await supabase.from("profiles").update({ moderation_exempt: true }).eq("id", TARGET_USER_ID);
  logger.info("moderation_exempt барқарор шуд.");

  // 6. Final summary.
  const { data: finalItems } = await supabase
    .from("items")
    .select("id, title, moderation_status, moderation_result")
    .in("id", insertedIds);
  const approved = (finalItems ?? []).filter((i) => i.moderation_status === "approved").length;
  const rejected = (finalItems ?? []).filter((i) => i.moderation_status === "rejected");
  const stillPending = (finalItems ?? []).filter((i) => i.moderation_status === "pending").length;

  console.log(`\n=== НАТИҶАИ НИҲОӢ ===`);
  console.log(`Ворид шуд: ${insertedIds.length} / ҳадаф: ${TARGET_NEW}`);
  console.log(`Партофта шуд (аллакай баргардонда): ${skippedResolved}`);
  console.log(`Партофта шуд (эҳтимоли паст): ${skippedLowConfidence}`);
  console.log(`Ноком: ${failed}`);
  console.log(`Тасдиқшуда: ${approved}`);
  console.log(`Радшуда: ${rejected.length}`);
  console.log(`Ҳанӯз дар интизор (timeout): ${stillPending}`);
  if (rejected.length > 0) {
    console.log(`\nЭлонҳои радшуда:`);
    rejected.forEach((r) => console.log(`  ${r.id} | ${r.title} | сабаб: ${r.moderation_result}`));
  }
}

main().catch((err) => {
  logger.error("Скрипт ноком шуд", { error: err.message });
  process.exit(1);
});
