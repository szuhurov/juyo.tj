/**
 * Қабати Telegram — танҳо гирифтани паёмҳои охирини канали ошкор
 * (session-и аллакай login-шуда истифода мешавад, ниг. login.ts).
 */
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { config } from "./config";
import { logger } from "./logger";

export interface TelegramPost {
  channel: string;
  messageId: number;
  text: string;
  date: string; // ISO
  postUrl: string;
  imageBuffer: Buffer | null;
}

let clientPromise: Promise<TelegramClient> | null = null;

function getClient(): Promise<TelegramClient> {
  if (!clientPromise) {
    if (!config.telegramSession) {
      throw new Error("TELEGRAM_SESSION нест — аввал login.ts-ро дар компютери худ иҷро кунед (README.md-ро бинед).");
    }
    const client = new TelegramClient(new StringSession(config.telegramSession), config.telegramApiId, config.telegramApiHash, {
      connectionRetries: 5,
    });
    clientPromise = client.connect().then(() => client);
  }
  return clientPromise;
}

export async function fetchChannelPosts(channel: string, limit: number, minId?: number): Promise<TelegramPost[]> {
  const client = await getClient();
  const posts: TelegramPost[] = [];

  try {
    const messages = await client.getMessages(channel, minId ? { limit, minId } : { limit });
    for (const msg of messages) {
      if (!msg.message && !msg.media) continue; // паёмҳои холӣ (масалан "join" service message) мегузарем

      let imageBuffer: Buffer | null = null;
      if (msg.photo) {
        try {
          const buf = await client.downloadMedia(msg, {});
          if (buf) imageBuffer = Buffer.from(buf as Buffer);
        } catch (err: any) {
          logger.warn("Боргирии акс ноком шуд", { channel, messageId: msg.id, error: err.message });
        }
      }

      posts.push({
        channel,
        messageId: msg.id,
        text: msg.message ?? "",
        date: new Date(msg.date * 1000).toISOString(),
        postUrl: `https://t.me/${channel}/${msg.id}`,
        imageBuffer,
      });
    }
  } catch (err: any) {
    // Канал тағир ёфта бошад / дастрас набошад — идома медиҳем, на crash.
    logger.error("Гирифтани паёмҳои канал ноком шуд", { channel, error: err.message });
  }

  return posts;
}

export async function disconnectListener() {
  if (clientPromise) {
    const client = await clientPromise;
    await client.disconnect();
  }
}
