# Telegram → juyo.tj import

Мушоҳида ва воридкунии эълонҳои "гумшуда/ёфтшуда" аз каналҳои ошкори Telegram, бо тасниф тавассути AI.

## Сохтор

| Файл | Вазифа |
|---|---|
| `config.ts` | Env vars |
| `logger.ts` | Логгери сохторёфта |
| `login.ts` | **ЯКДАФЪАИНА, дар компютери худ иҷро кунед** — session string мебарорад |
| `listener.ts` | Қабати Telegram (GramJS) — гирифтани паёмҳои канал |
| `classifier.ts` | Таснифи AI (OpenAI) — категория/ҳолат/шаҳр/телефон |
| `importer.ts` | Оркестратсия → `external_items` |
| `run-once.ts` | Иҷрои якдафъаина |
| `scheduler.ts` | Раванди тӯлонӣ — cron (пешфарз ҳар 30 дақиқа) |
| `Dockerfile` | Барои иҷрои `scheduler.ts` дар контейнер |

## Қадами 1 — Гирифтани api_id/api_hash (як бор)

1. https://my.telegram.org/apps -ро кушоед, бо рақами телефони худ ворид шавед.
2. "API development tools" -ро пахш кунед, форма пур кунед (App title/Short name — ҳар чиз, масалан "juyo-import").
3. `api_id` (рақам) ва `api_hash` (сатр)-ро нусхабардорӣ кунед.
4. Ба `.env.local` илова кунед:
   ```
   TELEGRAM_API_ID=1234567
   TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
   ```

## Қадами 2 — Login (як бор, дар компютери худ, на аз агент)

```bash
npm run telegram:login
```

Рақами телефон, рамзи SMS (ва 2FA агар фаъол бошад)-ро ворид кунед. Дар охир як **session string** мебарояд — онро ба `.env.local` илова кунед:

```
TELEGRAM_SESSION=<рамзи баровардашуда>
```

⚠️ Ин рамз калиди пурраи ҳисоби Telegram-и шумост — ҳаргиз онро push, log, ё дар ҷои ошкор нагузоред.

## Қадами 3 — Санҷиш ва иҷро

```bash
# Санҷиш — бе навиштан ба база, бе боркунии акс:
npm run telegram:import:dry

# Иҷрои воқеӣ (як бор):
npm run telegram:import
```

## Маълумот дар куҷо меравад

- Ҳар паём **фавран ба лентаи умумии juyo.tj нашр мешавад** — ба ҳисоби TARGET_USER_ID (константа дар `importer.ts`, аз рӯи хости возеҳи корбар), на профили сохта.
- **Тавсиф = матни аслии паём БЕ ТАҒЙИР** (AI ба тавсиф даст намезанад). **Унвон** ва **категория** аз AI (мувофиқи 6 категорияи худи juyo.tj: Electronics/Documents/Keys/Clothing/Pets/Other). **Рақами телефон** айнан аз матни ҳамон паём (агар бошад) — на рақами шахсии корбар.
- `external_items` ҳамчун журнали дедупликатсия дар паси парда истифода мешавад (то паёми якхела ду бор нашр нашавад) — UI-и admin барои он вуҷуд надорад.

## Cron (иҷрои даврӣ)

```bash
npm run telegram:scheduler
```

Барои production, инро тавассути `pm2`/`systemd`/Docker нигоҳ доред. Фосиларо бо `TELEGRAM_CRON_SCHEDULE` тағир диҳед (пешфарз `*/30 * * * *`).

### Docker (ихтиёрӣ)

```bash
docker build -f scripts/telegram-import/Dockerfile -t juyo-telegram-import .
docker run --env-file .env.local juyo-telegram-import
```

## Env vars

| Ном | Маънидод | Пешфарз |
|---|---|---|
| `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` | Аз my.telegram.org (Қадами 1) | — |
| `TELEGRAM_SESSION` | Аз `login.ts` (Қадами 2) | — |
| `TELEGRAM_CHANNELS` | Рӯйхати канал, бо вергул | `poteryashki_tj` |
| `TELEGRAM_MESSAGES_PER_RUN` | Ҳадди аксари паём дар як run, як канал | `500` |
| `TELEGRAM_CRON_SCHEDULE` | Синтаксиси cron | `*/30 * * * *` |
| `TELEGRAM_MIN_CONFIDENCE` | (Барои истифодаи оянда — ҳадди боварии AI) | `0.6` |
| `OPENAI_API_KEY` | Барои таснифи AI (агар набошад, ҳама "other"/номуайян мемонад) | — |

## Эҳтиромкорӣ

- Танҳо каналҳои ОШКОРО хонда мешаванд — ҳеҷ гуна дахолат ба чат/паёми хусусӣ.
- Агар сохтори паём/канал тағйир ёбад ё канал дастрас набошад, скрипт crash намекунад — log мекунад ва ба канали навбатӣ мегузарад.
