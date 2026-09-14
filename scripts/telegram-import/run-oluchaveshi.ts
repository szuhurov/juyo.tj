/**
 * One-time import of the last 150 posts from the t.me/oluchaveshi channel, on
 * behalf of Ali Mirzoev (allimirzoev2000@icloud.com, with his consent). Kept
 * deliberately separate from the shared importer.ts (recurring, for the
 * "juyo" TARGET_USER_ID) so it doesn't alter that recurring script:
 *  - title: a single word (not the 2-4 AI-generated words)
 *  - phone number: always fixed (not taken from the post text)
 *  - description: original text unchanged (same as importer.ts)
 *
 * Run: node --env-file=.env.local --import tsx scripts/telegram-import/run-oluchaveshi.ts
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
const LIMIT = 150;

function getClient() {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
}

function oneWordTitle(title: string, fallbackText: string): string {
  const source = title.trim() || fallbackText.trim();
  return source.split(/\s+/)[0] || "Эълон";
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

async function publishToFeed(
  supabase: ReturnType<typeof getClient>,
  post: TelegramPost,
  classification: Classification,
  imageUrl: string | null,
): Promise<string> {
  const title = oneWordTitle(classification.title, post.text);
  const { data: item, error: itemError } = await supabase
    .from("items")
    .insert({
      user_id: TARGET_USER_ID,
      title,
      description: post.text, // Original text unchanged — if the text contains a different phone number, it stays there as-is.
      category: classification.category,
      type: classification.status ?? "lost",
      phone_number: FIXED_PHONE, // Fixed, not taken from the post text.
      date: post.date.slice(0, 10),
      is_resolved: false,
      is_guest: false,
      moderation_status: "approved",
      moderation_result: `Imported from ${SOURCE} (${post.channel})`,
    })
    .select("id")
    .single();
  if (itemError) throw itemError;

  if (imageUrl) {
    const { error: imgError } = await supabase.from("item_images").insert({ item_id: item.id, image_url: imageUrl });
    if (imgError) logger.warn("item_images навишта нашуд", { itemId: item.id, error: imgError.message });
  }

  return item.id;
}

async function main() {
  const supabase = getClient();
  const result = { found: 0, imported: 0, failed: 0 };

  try {
    logger.info("Санҷиши канал", { channel: CHANNEL, limit: LIMIT });
    const posts = await fetchChannelPosts(CHANNEL, LIMIT);
    result.found = posts.length;
    logger.info("Паём ёфт шуд", { channel: CHANNEL, count: posts.length });

    for (const post of posts) {
      try {
        const classification = await classifyPost(post.text);
        const imageUrl = post.imageBuffer ? await uploadImage(supabase, post.imageBuffer) : null;
        const itemId = await publishToFeed(supabase, post, classification, imageUrl);

        const { error } = await supabase.from("external_items").upsert(
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
            published_item_id: itemId,
          },
          { onConflict: "source,source_channel,external_id" },
        );
        if (error) logger.warn("external_items (дедупликатсия) навишта нашуд", { error: error.message });

        result.imported++;
      } catch (err: any) {
        result.failed++;
        logger.error("Коркарди паём ноком шуд", { channel: CHANNEL, messageId: post.messageId, error: err.message });
      }
    }
  } finally {
    await disconnectListener();
  }

  logger.info("Воридкунӣ тамом шуд", result);
}

main().catch((err) => {
  logger.error("Скрипт ноком шуд", { error: err.message });
  process.exit(1);
});
