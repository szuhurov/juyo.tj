/**
 * Оркестратсия: listener (Telegram) + classifier (AI) → Supabase.
 *
 * Ҳар паём фавран ба лентаи умумии juyo.tj нашр мешавад — ба ҳисоби
 * худи корбар (TARGET_USER_ID, аз рӯи хости возеҳи корбар), на профили
 * сохта. Тавсиф = матни аслии паём БЕ ТАҒЙИР (AI даст намезанад), унвон
 * ва категория аз AI, рақами телефон низ айнан аз матни ҳамон паём (на
 * рақами шахсии корбар!). external_items ҳамчун журнали дедупликатсия
 * дар паси парда истифода мешавад (то паёми якхела ду бор нашр нашавад)
 * — UI-и admin барои он вуҷуд надорад, мустақим кор мекунад.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "./config";
import { logger } from "./logger";
import { fetchChannelPosts, disconnectListener, type TelegramPost } from "./listener";
import { classifyPost, type Classification } from "./classifier";

const SOURCE = "Telegram";
// Ба хости возеҳи корбар: ҳамаи эълонҳои воридшуда ба ҳамин ҳисоб нашр мешаванд.
const TARGET_USER_ID = "user_3GTmOz49mVZU6KeypHzMV14Dx10";

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

async function publishToFeed(
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
      description: post.text, // Матни аслӣ, бе тағйир — AI ба тавсиф даст намезанад.
      category: classification.category,
      type: classification.status ?? "lost",
      phone_number: classification.phone, // Рақами аз худи паём — на рақами шахсии корбар.
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

export interface ImportOptions {
  dryRun?: boolean;
}

export interface ImportResult {
  found: number;
  imported: number;
  failed: number;
}

export async function runImport(options: ImportOptions = {}): Promise<ImportResult> {
  const result: ImportResult = { found: 0, imported: 0, failed: 0 };
  const supabase = getClient();

  try {
    for (const channel of config.channels) {
      logger.info("Санҷиши канал", { channel });

      const { data: lastRow } = await supabase
        .from("external_items")
        .select("telegram_message_id")
        .eq("source", SOURCE)
        .eq("source_channel", channel)
        .order("telegram_message_id", { ascending: false })
        .limit(1)
        .maybeSingle();
      const minId = lastRow?.telegram_message_id ?? undefined;

      const posts = await fetchChannelPosts(channel, config.messagesPerChannel, minId);
      result.found += posts.length;
      logger.info("Паём ёфт шуд", { channel, count: posts.length, minId });

      for (const post of posts) {
        try {
          const classification = await classifyPost(post.text);

          if (options.dryRun) {
            logger.info("--dry-run", { post: { ...post, imageBuffer: post.imageBuffer ? "<buffer>" : null }, classification });
            continue;
          }

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
              phone_number: classification.phone,
              ai_confidence: classification.confidence,
              published_item_id: itemId,
            },
            { onConflict: "source,source_channel,external_id" },
          );
          if (error) logger.warn("external_items (дедупликатсия) навишта нашуд", { error: error.message });

          result.imported++;
        } catch (err: any) {
          result.failed++;
          logger.error("Коркарди паём ноком шуд", { channel, messageId: post.messageId, error: err.message });
        }
      }
    }
  } finally {
    await disconnectListener();
  }

  logger.info("Воридкунӣ тамом шуд", result as any);
  return result;
}
