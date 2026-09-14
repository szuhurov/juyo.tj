/**
 * Classifies a post with OpenAI — a short title, category (per juyo.tj's
 * own taxonomy), status (lost/found), city, phone (if explicitly present
 * in the text). The description does NOT come from here — the original
 * post text is used AS-IS as the description (see importer.ts), so no
 * information is lost or altered by the AI's hand. Graceful: if the AI
 * fails or returns malformed JSON, an "unknown" result is returned
 * (not a crash).
 */
import OpenAI from "openai";
import { config } from "./config";
import { logger } from "./logger";

// The same categories as juyo.tj itself (see lib/services/item-service.ts CATEGORIES) — so no extra mapping is needed.
export type TgCategory = "Electronics" | "Documents" | "Keys" | "Clothing" | "Pets" | "Other" | "LicensePlate" | "Wallet";
export type TgStatus = "lost" | "found";

export interface Classification {
  title: string;
  category: TgCategory;
  status: TgStatus | null;
  city: string | null;
  phone: string | null;
  /** Reward: if mentioned in the text — a specific amount (e.g.
   *  "50 somoni"), or, if the amount is unspecified, generic text ("A
   *  reward is offered"). If no reward is mentioned at all — null. */
  reward: string | null;
  /** true if the post reports that the item has ALREADY been returned to
   *  its owner/found (as opposed to a new lost/found post) — such a post
   *  should not be recorded as an active listing. */
  already_resolved: boolean;
  confidence: number;
}

const client = config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey }) : null;

const SYSTEM_PROMPT = `Ту дастёри таснифи паёмҳои "гумшуда/ёфтшуда" аз каналҳои Telegram-и Тоҷикистон ҳастӣ (матн бо забони тоҷикӣ/русӣ омехта). Баъзан акси ашё низ дода мешавад — онро ҳам барои дурустии унвон истифода бар.
Барои ҳар паём ТАНҲО як объекти JSON бармегардон, бе изоҳи иловагӣ, дар ин шакл:
{"title":"...","category":"Electronics|Documents|Keys|Clothing|Pets|Other|LicensePlate|Wallet","status":"lost|found|null","city":"...|null","phone":"...|null","reward":"...|null","already_resolved":true|false,"confidence":0.0-1.0}

Қоидаҳо:
- title: ХЕЛЕ кӯтоҳ — 1 калима беҳтарин аст, ҳадди аксар 2 калима (ҳамон забони паём). Аз матн ВА акс истифода бар, то навъи дурусти ашёро муайян кунӣ (масалан "iPhone", "Ҳамён", "Калид", "Гурба"). Истисно: агар ҳуҷҷат бошад ва номи шахс дар матн зикр шуда бошад, номро ҳам илова кун (масалан "Шиноснома Шарипов").
- category: Electronics (телефон, ноутбук, ва ғ.), Documents (шиноснома, шаҳодатнома, корт, ва ғ.), Keys (калид), Clothing (либос, пойафзол, сумка), Pets (ҳайвонот), LicensePlate (танҳо рақами давлатии мошин/номер), Wallet (ҳамён, кошелёк — новобаста аз он ки чӣ дар дохилаш аст), ё Other (ҳамаи дигар).
- status: "lost" агар паём дар бораи гум шудани чизе бошад, "found" агар дар бораи ёфтани чизи каси дигар бошад. Кӯшиш кун ҳамеша яке аз инҳоро муайян кунӣ; танҳо агар воқеан ҳеҷ аломат набошад — null.
- city: номи шаҳр/минтақа, агар дар матн зикр шуда бошад (масалан "Душанбе", "Хуҷанд"). Вагарна null.
- phone: рақами телефон ТАНҲО агар дар матни ҲАМИН паём ОШКОРО навишта шуда бошад — ва ТАНҲО ҳамон рақаме, ки ба таври возеҳ ҳамчун рақами тамос барои ҲАМИН ашё(и мушаххаси ҳамин паём) зикр шудааст (масалан баъд аз "занг занед", "тел.", "рақами ма"). Агар матн якчанд рақам дошта бошад ва маълум набошад кадомаш рақами тамос аст, ё агар рақам ба чизи/шахси дигар (на ба ҳамин ашё) тааллуқ дошта бошад, phone-ро null гузор. Ҳаргиз рақам эҷод накун ва ҳаргиз аз паёми дигар қарз нагир.
- reward: агар матн мукофот/тӯҳфа зикр кунад (масалан "мукофот", "вознаграждение", "тӯҳфа медиҳам") — агар андозаи мушаххас (сум/сомонӣ) зикр шуда бошад, ҳамон рақамро бо "сомонӣ" гузор; агар мукофот зикр шуда, вале андозааш номаълум/норавшан бошад, ба ҷои рақам матни "Мукофот пешниҳод мешавад" гузор. Агар ҳеҷ мукофот зикр нашудааст — null.
- already_resolved: true ТАНҲО агар паём возеҳан хабар диҳад, ки ашё аллакай ёфт шуда/ба соҳибаш баргардонда шудааст (масалан "соҳибаш ёфт шуд", "баргардонда шуд", "хайр, ёфт шуд"). Барои эълони оддии гумшуда/ёфтшуда — false.
- confidence: то чӣ андоза мутмаинӣ, ки ин паём воқеан дар бораи як ашёи гумшуда/ёфтшуда аст (на реклама, на табрик, на чизи дигари бе робита).`;

export async function classifyPost(text: string, imageBase64?: string): Promise<Classification> {
  const empty: Classification = {
    title: text.slice(0, 60),
    category: "Other",
    status: null,
    city: null,
    phone: null,
    reward: null,
    already_resolved: false,
    confidence: 0,
  };
  if (!client) {
    logger.warn("OPENAI_API_KEY нест — таснифи AI гузаронда мешавад.");
    return empty;
  }
  if (!text.trim()) return empty;

  try {
    const userContent: Array<Record<string, unknown>> = [{ type: "text", text: text.slice(0, 2000) }];
    if (imageBase64) {
      userContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" } });
    }

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent as any },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    // GPT sometimes returns the string "null" (rather than an actual JSON null) — both forms are treated the same.
    const clean = (v: unknown): string | null => (typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null" ? v.trim() : null);
    const CATEGORIES: TgCategory[] = ["Electronics", "Documents", "Keys", "Clothing", "Pets", "Other", "LicensePlate", "Wallet"];
    const category = CATEGORIES.includes(parsed.category) ? (parsed.category as TgCategory) : "Other";
    return {
      title: clean(parsed.title) || text.slice(0, 60),
      category,
      status: parsed.status === "lost" || parsed.status === "found" ? parsed.status : null,
      city: clean(parsed.city),
      phone: clean(parsed.phone),
      reward: clean(parsed.reward),
      already_resolved: parsed.already_resolved === true,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    };
  } catch (err: any) {
    logger.error("Таснифи AI ноком шуд", { error: err.message });
    return empty;
  }
}
