/**
 * Шаблонҳои саволҳои санҷиши моликият — барои эълонҳои "Ёфтшуда".
 * Финдер аз ин рӯйхат 2-3 саволро интихоб мекунад (ё саволи худро менависад),
 * то даъвогар пеш аз гирифтани рақами телефон исбот кунад, ки ӯ воқеан
 * соҳиби ашё аст.
 *
 * МУҲИМ: ҳамаи саволҳо бояд чизеро пурсанд, ки дар акси эълон дида
 * НАМЕШАВАД (на ранг, на бренд, на намуди берунӣ) — вагарна ҳар шахс,
 * ки акси эълонро дидааст, метавонад ҷавоб диҳад.
 */
"use client";

export type QuestionType = "yesno" | "input";

export interface QuestionTemplate {
  id: string;
  type: QuestionType;
  text: { tg: string; ru: string; en: string };
}

export const VERIFICATION_TEMPLATES: Record<string, QuestionTemplate[]> = {
  Electronics: [
    { id: "el_wallpaper", type: "input", text: { tg: "Дар экрани қулф (lock screen) чӣ расм гузошта шуда буд?", ru: "Какая картинка стоит на экране блокировки?", en: "What picture is set as the lock screen wallpaper?" } },
    { id: "el_sim", type: "input", text: { tg: "SIM-корти дохилаш аз кадом оператор буд?", ru: "SIM-карта какого оператора была внутри?", en: "Which carrier's SIM card was inside?" } },
    { id: "el_passcode_len", type: "input", text: { tg: "Рамзи қулфи экран чанд рақам/аломат дорад?", ru: "Из скольких цифр/символов состоит пароль экрана?", en: "How many digits/characters is the screen passcode?" } },
    { id: "el_case_content", type: "yesno", text: { tg: "Дар қафои қап (чехол) чизе пинҳон буд (пул, корт)?", ru: "За чехлом было что-то спрятано (деньги, карта)?", en: "Was something hidden behind the case (cash, a card)?" } },
    { id: "el_document", type: "yesno", text: { tg: "Ҳуҷҷати он (чек, гарантия, қуттӣ)-ро бо худ доред?", ru: "У вас есть документ на него (чек, гарантия, коробка)?", en: "Do you have the document for it (receipt, warranty, box)?" } },
  ],
  Documents: [
    { id: "doc_cards", type: "yesno", text: { tg: "Дар дохили ҳуҷҷат кортҳои дигар ҳам буданд?", ru: "Внутри были другие карты?", en: "Were there other cards inside?" } },
    { id: "doc_extra", type: "input", text: { tg: "Дар дохили ҳуҷҷат ё папка боз чӣ буд (пул, акс, коғаз)?", ru: "Что ещё было внутри документа/папки (деньги, фото, бумага)?", en: "What else was inside the document/folder (cash, a photo, paper)?" } },
    { id: "doc_where", type: "input", text: { tg: "Ҳуҷҷат дар кадом сумка, ҷайб ё папка буд?", ru: "В какой сумке, кармане или папке был документ?", en: "What bag, pocket, or folder was the document in?" } },
    { id: "doc_series", type: "input", text: { tg: "Ду рақами охирини силсилаи ҳуҷҷат чист?", ru: "Какие последние 2 цифры серии документа?", en: "What are the last 2 digits of the document's series number?" } },
  ],
  Keys: [
    { id: "key_locks", type: "input", text: { tg: "Ин калидҳо кадом ҷоро мекушоянд (хона, мошин, гараж, дафтар)?", ru: "Какие двери открывают эти ключи (дом, машина, гараж, офис)?", en: "What do these keys open (home, car, garage, office)?" } },
    { id: "key_extra_hidden", type: "input", text: { tg: "Дар якҷоягӣ бо калидҳо боз чӣ буд, ки дар акс дида намешавад (флешка, корт, ёддошт)?", ru: "Что ещё было вместе с ключами, чего не видно на фото (флешка, карта, записка)?", en: "What else was with the keys that isn't visible in the photo (a flash drive, a card, a note)?" } },
    { id: "key_engrave", type: "input", text: { tg: "Дар паси калид ё брелок навишта чист (агар бошад)?", ru: "Что написано/выгравировано на ключе или брелоке (если есть)?", en: "What is written or engraved on a key or the keychain (if anything)?" } },
  ],
  Clothing: [
    { id: "cl_pocket", type: "input", text: { tg: "Дар ҷайб чӣ буд?", ru: "Что было в кармане?", en: "What was in the pocket?" } },
    { id: "cl_inner_label", type: "input", text: { tg: "Дар нишони дохилӣ (даруни ёқа) чӣ навишта шудааст?", ru: "Что написано на внутренней бирке (за воротником)?", en: "What does the inner label (inside the collar) say?" } },
    { id: "cl_repair", type: "yesno", text: { tg: "Ягон ҷои дӯхта шуда ё вассакак дар ҷои дида нашаванда ҳаст?", ru: "Есть ли зашитое место или заплатка в незаметном месте?", en: "Is there a stitched repair or patch in a spot that isn't visible?" } },
  ],
  Pets: [
    { id: "pet_name", type: "input", text: { tg: "Номи ҳайвон чист?", ru: "Как зовут животное?", en: "What is the pet's name?" } },
    { id: "pet_command", type: "input", text: { tg: "Ба кадом фармон (масалан «нишин») итоат мекунад?", ru: "На какую команду (например «сидеть») он реагирует?", en: "What command (e.g. \"sit\") does it respond to?" } },
    { id: "pet_chip", type: "yesno", text: { tg: "Чип (микрочип) ё тамғаи тиббӣ дорад?", ru: "Есть микрочип или ветеринарная метка?", en: "Does it have a microchip or vet tag?" } },
    { id: "pet_habit", type: "input", text: { tg: "Одати махсуси он чист (масалан чӣ хел бозӣ мекунад, аз чӣ метарсад)?", ru: "Какая у него особая привычка (как играет, чего боится)?", en: "What's a distinctive habit (how it plays, what scares it)?" } },
  ],
  Other: [
    { id: "ot_contents", type: "input", text: { tg: "Дар дохили он чӣ буд?", ru: "Что было внутри?", en: "What was inside it?" } },
    { id: "ot_receipt", type: "yesno", text: { tg: "Расид ё чеки харид доред?", ru: "Есть чек или квитанция о покупке?", en: "Do you have a receipt?" } },
    { id: "ot_serial", type: "input", text: { tg: "Рақами силсилавӣ (serial) ё аломати махфие, ки дар акс дида намешавад, чист?", ru: "Какой серийный номер или скрытая примета, не видная на фото?", en: "What's the serial number or a hidden mark not visible in the photo?" } },
    { id: "ot_where_bought", type: "input", text: { tg: "Аз куҷо ё кай харида будед?", ru: "Где или когда вы это купили?", en: "Where or when did you buy it?" } },
  ],
};

export function getTemplatesForCategory(category: string): QuestionTemplate[] {
  return VERIFICATION_TEMPLATES[category] ?? VERIFICATION_TEMPLATES.Other;
}
