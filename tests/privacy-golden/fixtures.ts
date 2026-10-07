/**
 * Golden privacy images: synthetic photos with KNOWN sensitive values, so a
 * test can check that the published image no longer reveals them (a fresh
 * OCR of the output), that harmless text stays readable, and that codes are
 * covered. Rendered with sharp (librsvg); the portrait is
 * services/vision/test/fixtures/portrait.jpg. No real person's document is
 * used — every name and number here is invented.
 *
 * Every future change to the pipeline, a model or a runtime must keep this
 * suite passing (npm run test:privacy).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import QRCode from "qrcode";

const PORTRAIT = path.resolve(__dirname, "../../services/vision/test/fixtures/portrait.jpg");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Line = [x: number, y: number, size: number, text: string, opts?: { bold?: boolean; mono?: boolean; fill?: string; rotate?: number }];

function svg(width: number, height: number, bg: string, lines: Line[], extra = "") {
  const body = lines.map(([x, y, size, text, o = {}]) =>
    `<text x="${x}" y="${y}" font-family="${o.mono ? "Courier New" : "Arial"}" font-size="${size}"${o.bold ? ' font-weight="bold"' : ""}${o.rotate ? ` transform="rotate(${o.rotate} ${x} ${y})"` : ""} fill="${o.fill ?? "#151515"}">${esc(text)}</text>`).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${bg}"/>${extra}${body}</svg>`);
}

// EAN-13 bars, drawn directly (no barcode dependency needed for a fixture).
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = L.map((p) => p.replace(/./g, (b) => (b === "0" ? "1" : "0")));
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
function ean13(digits12: string, x: number, y: number, module: number, height: number) {
  const d = digits12.split("").map(Number);
  const sum = d.reduce((s, v, i) => s + v * (i % 2 ? 3 : 1), 0);
  const all = [...d, (10 - (sum % 10)) % 10];
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += (PARITY[all[0]][i - 1] === "L" ? L : G)[all[i]];
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[all[i]];
  bits += "101";
  let rects = "";
  for (let i = 0; i < bits.length; i++) if (bits[i] === "1") rects += `<rect x="${x + i * module}" y="${y}" width="${module}" height="${height}" fill="#000"/>`;
  return { rects, code: all.join("") };
}

async function withPortrait(image: Buffer, left: number, top: number, w: number, h: number) {
  const portrait = await sharp(await readFile(PORTRAIT)).extract({ left: 230, top: 60, width: 360, height: 450 }).resize(w, h).toBuffer();
  return sharp(image).composite([{ input: portrait, left, top }]).jpeg({ quality: 90 }).toBuffer();
}

export interface GoldenImage {
  name: string;
  category: string;
  bytes: Buffer;
  /** Must not be readable in the uploaded image. */
  secrets: string[];
  /** Should stay readable (the pipeline must not cover everything). Words the rus+eng
   * checker itself reads reliably — Tajik-only letters (ҳ, ӣ, ҷ…) are often misread by it. */
  keep?: string[];
  /** Expected to be judged a document/card (→ mandatory review). */
  document?: boolean;
  /** Codes whose payload must not be decodable afterwards. */
  codes?: string[];
  /** Codes that must stay decodable (JUYO's own QR). */
  keepCodes?: string[];
}

export async function buildGoldenImages(): Promise<GoldenImage[]> {
  const passportSvg = svg(1400, 900, "#efe9dc", [
    [480, 80, 44, "ҶУМҲУРИИ ТОҶИКИСТОН", { bold: true }],
    [480, 140, 38, "ШИНОСНОМА / PASSPORT", { bold: true }],
    [480, 230, 24, "Насаб / Surname"], [480, 270, 36, "ИВАНОВ", { bold: true }], [480, 305, 30, "IVANOV"],
    [480, 360, 24, "Ном / Given name"], [480, 400, 36, "ИВАН", { bold: true }],
    [480, 460, 24, "Санаи таваллуд / Date of birth"], [480, 500, 34, "12.05.1990", { bold: true }],
    [480, 560, 24, "Рақами шиноснома / Passport No."], [480, 600, 34, "A1234567", { bold: true }],
    [40, 780, 34, "P<TJKIVANOV<<IVAN<<<<<<<<<<<<<<<<<<<<<<<<<<", { mono: true }],
    [40, 840, 34, "A12345678TJK9005123M3001017<<<<<<<<<<<<<<06", { mono: true }],
  ]);
  const passport = await withPortrait(await sharp(passportSvg).png().toBuffer(), 60, 180, 340, 420);
  const passportSecrets = ["A1234567", "12.05.1990", "ИВАНОВ", "IVANOV", "P<TJK"];

  const idCard = await withPortrait(await sharp(svg(1300, 820, "#dfe9f2", [
    [420, 70, 34, "ҶУМҲУРИИ ТОҶИКИСТОН", { bold: true }],
    [420, 120, 30, "КОРТИ ШАХСИЯТ / ID CARD", { bold: true }],
    [420, 210, 22, "Насаб"], [420, 245, 32, "РАҲИМОВА"],
    [420, 300, 22, "Ном"], [420, 335, 32, "МАДИНА"],
    [420, 390, 22, "Санаи таваллуд"], [420, 425, 30, "03.11.1987"],
    [420, 480, 22, "Рақам"], [420, 515, 30, "TJ 0042317"],
    [420, 600, 20, "Суроға: ш. Хуҷанд, кӯчаи Ленин 12"],
  ])).png().toBuffer(), 50, 160, 320, 400);

  const bankCard = await sharp(svg(1200, 760, "#1d3b6a", [
    [60, 110, 44, "DUSHANBE CITY BANK", { bold: true, fill: "#fff" }],
    [60, 420, 64, "4111 1111 1111 1111", { mono: true, fill: "#fff" }],
    [60, 520, 30, "VALID THRU 08/29", { fill: "#fff" }],
    [60, 640, 38, "IVAN IVANOV", { fill: "#fff" }],
    [900, 680, 40, "VISA", { bold: true, fill: "#fff" }],
  ])).jpeg({ quality: 90 }).toBuffer();

  const label = await sharp(svg(1200, 700, "#ffffff", [
    [60, 90, 40, "Galaxy A54 5G", { bold: true }],
    [60, 190, 34, "Model: SM-A546E/DS"],
    [60, 280, 34, "IMEI: 490154203237518"],
    [60, 360, 34, "IMEI2: 356938035643809"],
    [60, 450, 34, "S/N: R58T41ABCDE"],
    [60, 560, 30, "Made in Vietnam"],
  ])).jpeg({ quality: 90 }).toBuffer();

  const contactNote = await sharp(svg(1200, 600, "#fffbe6", [
    [60, 100, 40, "Агар ёфтед, занг занед:"],
    [60, 200, 44, "+992 93 123 45 67", { bold: true }],
    [60, 300, 40, "ivan.ivanov@mail.tj"],
    [60, 400, 34, "Адрес: ш. Душанбе, кӯчаи Рӯдакӣ 25, кв. 14"],
    [60, 500, 30, "Мукофот: 500 сомонӣ"],
  ])).jpeg({ quality: 90 }).toBuffer();

  const smallText = await sharp(svg(1600, 1200, "#f4f1ea", [
    [80, 200, 60, "Калидҳои мошин", { bold: true }],
    [80, 1100, 20, "тел. 92 777 88 99"],
  ])).jpeg({ quality: 88 }).toBuffer();

  const rotatedText = await sharp(svg(1200, 900, "#ffffff", [
    [200, 700, 44, "+992 90 555 44 33", { rotate: -12 }],
    [200, 200, 40, "Рюкзаки кабуд"],
  ])).jpeg({ quality: 90 }).toBuffer();

  const qrPersonal = await QRCode.toBuffer("BEGIN:VCARD\nVERSION:3.0\nFN:Ivan Ivanov\nTEL:+992931234567\nEND:VCARD", { width: 360, margin: 1 });
  const qrJuyo = await QRCode.toBuffer("https://juyo.tj/qr/3f9a1c", { width: 360, margin: 1 });
  const qr = await sharp(svg(1200, 600, "#ffffff", [[60, 60, 34, "Скан кунед"], [700, 60, 34, "JUYO QR"]]))
    .composite([{ input: qrPersonal, left: 60, top: 120 }, { input: qrJuyo, left: 700, top: 120 }])
    .jpeg({ quality: 92 }).toBuffer();
  const smallQr = await sharp(svg(1600, 1200, "#e9eef2", [[80, 120, 50, "Калидбанд", { bold: true }]]))
    .composite([{ input: await QRCode.toBuffer("https://pay.example.com/u/83920?ref=ivan", { width: 170, margin: 1 }), left: 1300, top: 950 }])
    .jpeg({ quality: 90 }).toBuffer();

  const bars = ean13("590123412345", 200, 150, 6, 260);
  const barcode = await sharp(svg(1200, 600, "#ffffff", [[200, 470, 34, "Қуттии телефон"]], bars.rects)).jpeg({ quality: 92 }).toBuffer();

  const noPii = await sharp(svg(1200, 700, "#d9e4ef", [
    [60, 120, 48, "Ҳамёни сиёҳи чармӣ", { bold: true }],
    [60, 240, 36, "Дар автобуси 8 гум шуд"],
    [60, 340, 36, "Lost black leather wallet"],
    [60, 440, 36, "NIKE"],
  ])).jpeg({ quality: 90 }).toBuffer();

  // Two sensitive objects in one photo: a card on top of a note.
  const multi = await sharp(contactNote).resize(1600, 800, { fit: "fill" })
    .composite([{ input: await sharp(bankCard).resize(560).toBuffer(), left: 1000, top: 60 }])
    .jpeg({ quality: 90 }).toBuffer();

  return [
    { name: "passport", category: "Documents", bytes: passport, secrets: passportSecrets, keep: ["ШИНОСНОМА"], document: true },
    { name: "passport_in_bag_category", category: "Bag", bytes: passport, secrets: passportSecrets, document: true },
    { name: "passport_low_light", category: "Documents", bytes: await sharp(passport).modulate({ brightness: 0.45 }).jpeg({ quality: 70 }).toBuffer(), secrets: passportSecrets, document: true },
    { name: "passport_low_quality", category: "Documents", bytes: await sharp(passport).resize(700).jpeg({ quality: 35 }).toBuffer(), secrets: ["A1234567", "12.05.1990", "ИВАНОВ", "IVANOV"], document: true },
    { name: "passport_blurry", category: "Documents", bytes: await sharp(passport).blur(1.2).jpeg({ quality: 80 }).toBuffer(), secrets: ["A1234567", "ИВАНОВ", "IVANOV", "12.05.1990"], document: true },
    { name: "passport_rotated_90", category: "Documents", bytes: await sharp(passport).rotate(90).toBuffer(), secrets: ["A1234567", "12.05.1990", "ИВАНОВ", "IVANOV"], document: true },
    { name: "passport_cropped", category: "Documents", bytes: await sharp(passport).extract({ left: 420, top: 180, width: 980, height: 720 }).toBuffer(), secrets: ["A1234567", "12.05.1990", "ИВАНОВ"], document: true },
    { name: "national_id_in_wallet_category", category: "Wallet", bytes: idCard, secrets: ["РАҲИМОВА", "03.11.1987", "0042317", "Ленин"], document: true },
    { name: "bank_card", category: "Cards", bytes: bankCard, secrets: ["4111 1111 1111 1111", "4111111111111111", "IVANOV", "08/29"], document: true },
    { name: "bank_card_in_wallet_category", category: "Wallet", bytes: bankCard, secrets: ["4111 1111 1111 1111", "4111111111111111", "IVANOV", "08/29"], document: true },
    { name: "device_label", category: "Phone", bytes: label, secrets: ["490154203237518", "356938035643809"], keep: ["Galaxy"] },
    { name: "contact_note", category: "Other", bytes: contactNote, secrets: ["931234567", "+992 93 123 45 67", "ivan.ivanov@mail.tj"], keep: ["Мукофот"] },
    { name: "small_text_phone", category: "Keys", bytes: smallText, secrets: ["927778899"], keep: ["мошин"] },
    { name: "rotated_phone", category: "Bag", bytes: rotatedText, secrets: ["905554433"] },
    { name: "qr_codes", category: "Other", bytes: qr, secrets: [], codes: ["BEGIN:VCARD"], keepCodes: ["https://juyo.tj/qr/3f9a1c"] },
    { name: "small_qr", category: "Keys", bytes: smallQr, secrets: [], codes: ["https://pay.example.com"] },
    { name: "barcode_ean13", category: "Phone", bytes: barcode, secrets: [], codes: [bars.code] },
    { name: "multiple_objects", category: "Other", bytes: multi, secrets: ["931234567", "ivan.ivanov@mail.tj", "4111111111111111"], document: true },
    { name: "no_pii_false_positive", category: "Wallet", bytes: noPii, secrets: [], keep: ["автобуси", "Lost", "NIKE"] },
  ];
}
