/**
 * ЯКДАФЪАИНА — ДАР КОМПЮТЕРИ ХУДАТОН ИҶРО КУНЕД (на аз агент/CI).
 *
 * Ин скрипт бо GramJS ба ҳисоби воқеии Telegram-и шумо (бо рақами
 * телефон + рамзи SMS, эҳтимол 2FA) login мекунад ва як "session string"
 * мебарорад — ин рамз баъд ҳамчун TELEGRAM_SESSION дар .env.local
 * захира мешавад, то listener.ts/scheduler.ts дигар ба login-и
 * интерактивӣ ниёз надошта бошанд.
 *
 * Пеш аз иҷро: TELEGRAM_API_ID ва TELEGRAM_API_HASH-ро аз
 * https://my.telegram.org/apps дар .env.local гузоред (ниг. README.md).
 *
 * Истифода: npx tsx --env-file=.env.local scripts/telegram-import/login.ts
 */
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input";
import { config } from "./config";

async function main() {
  if (!config.telegramApiId || !config.telegramApiHash) {
    console.error("TELEGRAM_API_ID / TELEGRAM_API_HASH нест — аввал онҳоро аз my.telegram.org гиред (README.md-ро бинед).");
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(""), config.telegramApiId, config.telegramApiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Рақами телефони Telegram (бо +992...): "),
    password: async () => await input.text("Рамзи 2FA (агар фаъол бошад, вагарна холӣ бигузоред): "),
    phoneCode: async () => await input.text("Рамзи аз SMS/Telegram омада: "),
    onError: (err) => console.error(err),
  });

  console.log("\nLogin муваффақ буд!\n");
  console.log("Ин рамзро ба .env.local ҳамчун TELEGRAM_SESSION илова кунед:\n");
  console.log(client.session.save());
  console.log("\n(Ин рамз калиди пурраи ҳисоби шумост — ҳаргиз онро дар ҷои ошкор нагузоред ё push накунед.)");

  await client.disconnect();
  process.exit(0);
}

main();
