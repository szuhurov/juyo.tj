/**
 * Воридоти дуюм (такмилёфта)-и 100 паёми охирин аз t.me/oluchaveshi, ба номи
 * Ali Mirzoev (allimirzoev2000@icloud.com, бо розигии ӯ):
 *  - унвон: муқаррарӣ (2-4 калимаи AI, на кӯтоҳшуда)
 *  - moderation: ВОҚЕӢ — ҳар элон 'pending' сар мешавад, trigger-и муқаррарӣ
 *    AI-ро занг мезанад (moderation_exempt-и Ali муваққатан хомӯш карда
 *    мешавад, то bypass нашавад — сабаби ин версия маҳз ҳамин аст: партияи
 *    аввал бе тафтиш буд ва як акси хеле ҳассос (ҳуҷҷати ҳарбӣ + чеки
 *    бонкӣ) бе назорат нашр шуда буд)
 *  - рақами телефон: собит 111212331 (мисли пештара)
 *  - тавсиф: матни аслӣ бетағйир
 *
 * Иҷро: node --env-file=.env.local --import tsx scripts/telegram-import/run-oluchaveshi-v2.ts
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
const LIMIT = 100;
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
      type: classification.status ?? "lost",
      phone_number: FIXED_PHONE,
      date: post.date.slice(0, 10),
      is_resolved: false,
      is_guest: false,
      moderation_status: "pending", // ВОҚЕӢ тафтиш мешавад — на хардкод 'approved'.
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
      type: classification.status,
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

  // 1. Муваққатан хомӯш кардани bypass, то moderation воқеан кор кунад.
  await supabase.from("profiles").update({ moderation_exempt: false }).eq("id", TARGET_USER_ID);
  logger.info("moderation_exempt муваққатан хомӯш карда шуд.");

  // 2. Гирифтани 100 паёми охирин.
  const posts = await fetchChannelPosts(CHANNEL, LIMIT);
  logger.info("Паём ёфт шуд", { channel: CHANNEL, count: posts.length });

  const insertedIds: string[] = [];
  let failed = 0;

  // 3. Дар партияҳои хурд ворид мекунем — то ҳама дар як лаҳза trigger назанад.
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    for (const post of batch) {
      try {
        const classification = await classifyPost(post.text);
        const imageUrl = post.imageBuffer ? await uploadImage(supabase, post.imageBuffer) : null;
        const itemId = await insertItem(supabase, post, classification, imageUrl);
        insertedIds.push(itemId);
      } catch (err: any) {
        failed++;
        logger.error("Коркарди паём ноком шуд", { messageId: post.messageId, error: err.message });
      }
    }
    logger.info(`Партияи ${i / BATCH_SIZE + 1} ворид шуд: ${batch.length} паём`);
    await sleep(BATCH_DELAY_MS);
  }

  await disconnectListener();
  logger.info("Воридкунӣ тамом шуд", { imported: insertedIds.length, failed });

  // 4. Интизори тамом шудани moderation-и воқеӣ.
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

  // 5. Барқарор кардани bypass барои элонҳои ояндаи Ali (тавассути wizard-и оддӣ).
  await supabase.from("profiles").update({ moderation_exempt: true }).eq("id", TARGET_USER_ID);
  logger.info("moderation_exempt барқарор шуд.");

  // 6. Хулосаи ниҳоӣ.
  const { data: finalItems } = await supabase
    .from("items")
    .select("id, title, moderation_status, moderation_result")
    .in("id", insertedIds);
  const approved = (finalItems ?? []).filter((i) => i.moderation_status === "approved").length;
  const rejected = (finalItems ?? []).filter((i) => i.moderation_status === "rejected");
  const stillPending = (finalItems ?? []).filter((i) => i.moderation_status === "pending").length;

  console.log(`\n=== НАТИҶАИ НИҲОӢ ===`);
  console.log(`Ворид шуд: ${insertedIds.length}, ноком: ${failed}`);
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
