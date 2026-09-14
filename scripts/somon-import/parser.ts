/**
 * The parsing layer — separated from HTTP, so testing is easy. All
 * functions are "graceful": if somon.tj's HTML structure changes,
 * instead of crashing they return an empty result/null and log a
 * warning — the import continues, only those records are lost.
 */
import * as cheerio from "cheerio";
import { logger } from "./logger";
import type { SearchCard, ListingDetail } from "./types";

export function parseSearchResults(html: string): SearchCard[] {
  try {
    const $ = cheerio.load(html);
    const results: SearchCard[] = [];
    $(".advert-grid[data-id]").each((_, el) => {
      const $el = $(el);
      const externalId = $el.attr("data-id");
      const href = $el.find("a.advert-grid__content-title").attr("href");
      if (!externalId || !href) return;
      const title = $el.find("a.advert-grid__content-title").text().trim();
      const location = $el.find(".advert-grid__content-place").text().trim() || null;
      const bgStyle = $el.find(".advert-grid__body-image-slide").attr("style") || "";
      const imgMatch = bgStyle.match(/url\(([^)]+)\)/);
      results.push({
        externalId,
        url: new URL(href, "https://somon.tj").toString(),
        title,
        location,
        cardImage: imgMatch ? imgMatch[1] : null,
      });
    });
    if (results.length === 0) {
      logger.warn("Ягон карт дар саҳифаи ҷустуҷӯ ёфт нашуд — эҳтимол HTML-и somon.tj тағйир ёфтааст.");
    }
    return results;
  } catch (err: any) {
    logger.error("parseSearchResults ноком шуд", { error: err.message });
    return [];
  }
}

export function parseDetailPage(html: string): ListingDetail {
  const empty: ListingDetail = { title: null, description: null, images: [], category: null, publishedAt: null, raw: {} };
  try {
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr("content")?.trim() || null;
    const description = $('meta[property="og:description"]').attr("content")?.trim() || null;
    const category = $("[data-category]").first().attr("data-category")?.trim() || null;

    // All images belonging to THIS listing itself are img.announcement__images-item,
    // not .js-image-page-advert-grid (that belongs to the "similar listings"
    // widget at the bottom of the page, not to this listing itself — if we
    // used it, other listings' images would get mixed in).
    const images = new Set<string>();
    $('img.announcement__images-item[itemprop="image"]').each((_, el) => {
      const src = $(el).attr("data-full") || $(el).attr("src");
      if (src) images.add(src);
    });
    if (images.size === 0) {
      const ogImage = $('meta[property="og:image"]').attr("content")?.trim();
      if (ogImage && !ogImage.includes("/static/images/")) images.add(ogImage);
    }

    const dateText = $(".date-meta").first().text().trim(); // "Опубликовано: 11.07.2026 09:37"
    const dateMatch = dateText.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
    const publishedAt = dateMatch
      ? new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T${dateMatch[4]}:${dateMatch[5]}:00+05:00`).toISOString()
      : null;

    return {
      title,
      description,
      images: Array.from(images),
      category,
      publishedAt,
      raw: { dateText, category },
    };
  } catch (err: any) {
    logger.error("parseDetailPage ноком шуд", { error: err.message });
    return empty;
  }
}

// Guesses lost/found from keywords in the title — if it's not clear,
// it stays null (the admin decides).
export function guessType(title: string): "lost" | "found" | null {
  const t = title.toLowerCase();
  if (/найден|ёфт|ёфтшуда|топ/.test(t)) return "found";
  if (/гум |гумшуда|потерян|утерян|утеря/.test(t)) return "lost";
  return null;
}
