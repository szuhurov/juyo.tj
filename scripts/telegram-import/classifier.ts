/**
 * Таснифи паём бо OpenAI — унвони кӯтоҳ, категория (мувофиқи таксономияи
 * худи juyo.tj), ҳолат (гумшуда/ёфтшуда), шаҳр, телефон (агар дар матн
 * ошкоро бошад). Тавсиф аз ин ҷо НАМЕОЯД — matни аслии паём БЕ ТАҒЙИР
 * ҳамчун тавсиф истифода мешавад (ниг. importer.ts), то ҳеҷ маълумот аз
 * дасти AI гум/тағйир наёбад. Graceful: агар AI ноком шавад ё JSON
 * нодуруст баргардонад, натиҷаи "номуайян" бармегардад (на crash).
 */
import OpenAI from "openai";
import { config } from "./config";
import { logger } from "./logger";

// Ҳамон категорияҳои худи juyo.tj (ниг. lib/services/item-service.ts CATEGORIES) — то ҳеҷ харитасозии иловагӣ лозим набошад.
export type TgCategory = "Electronics" | "Documents" | "Keys" | "Clothing" | "Pets" | "Other" | "LicensePlate" | "Wallet";
export type TgStatus = "lost" | "found";

export interface Classification {
  title: string;
  category: TgCategory;
  status: TgStatus | null;
  city: string | null;
  phone: string | null;
  /** Мукофот: агар дар матн зикр шуда бошад — андозаи мушаххас (масалан
   *  "50 сомонӣ") ё, агар андоза номаълум бошад, матни умумӣ ("Мукофот
   *  пешниҳод мешавад"). Агар ҳеҷ мукофот зикр нашуда бошад — null. */
  reward: string | null;
  /** true агар паём хабар диҳад, ки ашё АЛЛАКАЙ ба соҳибаш баргардонда
   *  шудааст/ёфта шудааст (на эълони нави гумшуда/ёфтшуда) — чунин паём
   *  набояд ҳамчун элони фаъол сабт шавад. */
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
    // GPT баъзан сатри "null" (на JSON null-и воқеӣ) бармегардонад — ҳарду шаклро якхела мегирем.
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
