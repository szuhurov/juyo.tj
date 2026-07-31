/**
 * Ин саҳифаи асосии мост (Главная).
 * Дар ин ҷо ҳамаи эълонҳо нишон дода мешаванд. Одамон метавонанд аз рӯи категорияҳо филтр кунанд
 * ё ҷустуҷӯ кунанд, то чизҳои гумшуда ё ёфтшударо пайдо намоянд.
 *
 * Server Component: саҳифаи аввали натиҷаро дар сервер мегирад, то HTML-и
 * аввалия итемҳоро аллакай дошта бошад (Google/SEO) — на танҳо баъд аз
 * fetch-и клиентӣ пайдо шавад. Қисми интерактивӣ (филтр, infinite scroll)
 * дар home-client.tsx аст.
 */
import { unstable_cache } from "next/cache";
import { ItemService } from "@/lib/services/item-service";
import { HomeClient } from "./home-client";

// ItemService.getItems({}) як RPC-и Supabase (search_items) аст, ки бе кэш
// ҳар БОР — на танҳо бори аввал, балки дар ҳар гузариш ба "/" (масалан
// home → QR → home) — аз нав иҷро мешуд (400–1200ms), ки боиси он мешуд,
// ки loading.tsx (skeleton) дар ҳар гузариш пайдо шавад, ҳатто агар
// корбар чанд сония пеш аллакай саҳифаи асосиро дида буд. 15 сония кэш
// ин таъхирро нест мекунад — эълонҳои нав то 15 сония дертар пайдо
// мешаванд (арзиши хурд), вале гузариш байни саҳифаҳо фаврӣ мешавад.
const getCachedHomeItems = unstable_cache(
  () => ItemService.getItems({}),
  ["home-initial-items"],
  { revalidate: 15 },
);

// Ин саҳифа ягон dynamic function (cookies()/headers()/auth()) истифода
// намекунад, пас Next.js онро статикӣ render мекунад — HTML/RSC-и худи
// route (Full Route Cache) АЛОҲИДА аз Data Cache-и unstable_cache боло
// аст. Бе ин экспорт, HTML-и саҳифа метавонад аз давраи кэши дохилӣ (15с)
// дертар нав шавад — эълони нав дар база аллакай ҳаст, аммо HTML-и
// фиристодашуда ба боздидкунандагони нав то дафъаи навбатии revalidate-и
// РОҲ (на танҳо маълумот) куҳна мемонад. revalidate-и якхела (15с) дар
// ин ҷо ҳарду сатҳро синхрон нигоҳ медорад.
export const revalidate = 15;

export default async function HomePage() {
  let initialItems: Awaited<ReturnType<typeof ItemService.getItems>> = [];
  try {
    initialItems = await getCachedHomeItems();
  } catch {
    // Агар fetch-и сервер ноком шавад, клиент худаш fetch мекунад —
    // рендери саҳифа манъ намешавад.
  }

  return <HomeClient initialItems={initialItems} />;
}
