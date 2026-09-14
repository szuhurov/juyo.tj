/**
 * The HTTP layer — only fetches the HTML of somon.tj's public pages
 * (respects robots.txt: /search/... is not disallowed, only some
 * query parameters and /mobile_search/, /profile/, etc. are disallowed,
 * and this script never goes to those).
 */
import { config } from "./config";
import { logger } from "./logger";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string, attempt = 1): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": config.userAgent, "Accept-Language": "ru,tg;q=0.9,en;q=0.8" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.text();
  } catch (err: any) {
    if (attempt < 2) {
      logger.warn(`Дархост ноком шуд, такрор мекунем`, { url, attempt, error: err.message });
      await sleep(1500);
      return fetchHtml(url, attempt + 1);
    }
    throw err;
  }
}

export async function fetchSearchPage(query: string): Promise<string> {
  const url = `${config.searchBaseUrl}?q=${encodeURIComponent(query)}`;
  logger.info("Гирифтани саҳифаи ҷустуҷӯ", { url });
  return fetchHtml(url);
}

export async function fetchDetailPage(url: string): Promise<string> {
  await sleep(config.requestDelayMs);
  return fetchHtml(url);
}
