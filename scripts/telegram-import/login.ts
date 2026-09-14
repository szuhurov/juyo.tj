/**
 * ONE-OFF — RUN ON YOUR OWN COMPUTER (not from an agent/CI).
 *
 * This script uses GramJS to log in to your real Telegram account (with
 * your phone number + SMS code, possibly 2FA) and produces a "session
 * string" — this string is then stored as TELEGRAM_SESSION in
 * .env.local, so that listener.ts/scheduler.ts no longer need an
 * interactive login.
 *
 * Before running: set TELEGRAM_API_ID and TELEGRAM_API_HASH from
 * https://my.telegram.org/apps in .env.local (see README.md).
 *
 * Usage: npx tsx --env-file=.env.local scripts/telegram-import/login.ts
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
