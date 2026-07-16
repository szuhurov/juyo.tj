# Somon.tj → juyo.tj import

Воридкунандаи эълонҳои "паспорт" (Гумшуда/Ёфтшуда) аз [somon.tj](https://somon.tj) ба juyo.tj.

## Сохтор

| Файл | Вазифа |
|---|---|
| `config.ts` | Env vars, танзимоти умумӣ |
| `logger.ts` | Логгери сохторёфта (вақт + сатҳ) |
| `scraper.ts` | Қабати HTTP — танҳо гирифтани HTML (retry, delay) |
| `parser.ts` | HTML → маълумот (cheerio); graceful — ҳеҷ гоҳ crash намекунад |
| `importer.ts` | Оркестратсия: scraper+parser → Supabase (`external_items` + нашр ба `items`) |
| `run-once.ts` | Иҷрои якдафъаина аз терминал |
| `scheduler.ts` | Раванди тӯлонӣ — `runImport`-ро аз рӯи cron даврӣ мекунад |

## Маълумот дар куҷо меравад

1. Ҳар эълон дар `external_items` upsert мешавад — `unique(source, external_id)` кафолат медиҳад, ки иҷрои такрорӣ duplicate намесозад.
2. Агар ҳанӯз нашр нашуда бошад, ҳамон лаҳза ба `items` (+ `item_images`) низ **нашр мешавад** — бе профили сохта (`user_id = null`), бе рақами телефон. Номи шахс танҳо дар матни унвон мемонад (мисли аслаш дар somon.tj), на ҳамчун профили корбарӣ.
3. `external_items.published_item_id` пайванди байни ду сабтро нигоҳ медорад.
4. Admin аз панели `/admin/external-items` рақами телефонро дастӣ илова мекунад — он худкор ба эълони зинда низ мегузарад (ниг. `app/api/admin/external-items/[id]/route.ts`).

## Оғоз

```bash
# 1. Applying migration (як бор, бо иҷозати худи шумо):
#    supabase/migrations/20260723000000_external_items.sql

# 2. Санҷиш — бе навиштан ба база:
npm run somon:import:dry

# 3. Иҷрои воқеӣ (як бор):
npm run somon:import

# Гузинаҳо: --query "..." (пешфарз: "паспорт"), --no-publish (танҳо
# external_items, ба items нашр накунад)
npx tsx --env-file=.env.local scripts/somon-import/run-once.ts --query "ёфтшуда" --no-publish
```

## Cron (иҷрои даврӣ)

`scheduler.ts` раванди **тӯлонӣ** аст (бояд кушода бимонад) — пешфарз ҳар 6 соат (`0 */6 * * *`), на ҳар 15 дақиқа, то баррасии дастии admin (пур кардани телефон) ба вақт расад:

```bash
npm run somon:scheduler
```

Барои иҷрои ҳақиқии production, инро тавассути `pm2`, `systemd` ё Windows Task Scheduler нигоҳ доред (раванди оддии терминал бо бастани терминал қатъ мешавад). Фосиларо бо `SOMON_CRON_SCHEDULE` (env var, синтаксиси cron) тағир диҳед.

## Env vars

| Ном | Маънидод | Пешфарз |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Аллакай дар `.env.local` ҳастанд | — |
| `SOMON_SEARCH_URL` | Базаи URL-и ҷустуҷӯ | `https://somon.tj/search/dushanbe/` |
| `SOMON_SEARCH_QUERY` | Калимаи ҷустуҷӯ | `паспорт` |
| `SOMON_REQUEST_DELAY_MS` | Фосила байни дархостҳо (эҳтиром ба сервер) | `800` |
| `SOMON_CRON_SCHEDULE` | Синтаксиси cron барои scheduler | `0 */6 * * *` |

## Эҳтиромкории техникӣ

- `robots.txt`-и somon.tj тафтиш шудааст: `/search/...?q=` манъ **нест** (танҳо `/mobile_search/`, `/?page=`, `/profile/` ва монанди инҳо манъ ҳастанд, ки ин скрипт ба онҳо намеравад).
- Байни ҳар дархост фосилаи 800мс (`SOMON_REQUEST_DELAY_MS`) — сервери somon.tj бомбаборон намешавад.
- **Рақами телефон қасдан гирифта намешавад** — somon.tj онро паси воридшавии ҳисоб (login) пинҳон мекунад; ин маҳдудияти қасдан гузошташуда аст, на танҳо як AJAX-и одӣ, ва убур кардани он (бо ҳисоби бот) дигар аз доираи parsing-и оддии маълумоти ошкор мебарояд.
- Агар сохтори HTML-и somon.tj тағйир ёбад, `parser.ts` warning мезанад ва рӯйхати холӣ бармегардонад — на crash. `importer.ts` низ ҳар як эълони ноком бударо log карда, ба навбатӣ мегузарад.
