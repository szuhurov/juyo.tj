/**
 * This is our home page (Home).
 * All listings are shown here. People can filter by categories or search,
 * to find lost or found items.
 *
 * Server Component: fetches the first page of results on the server, so the
 * initial HTML already has the items (Google/SEO) — instead of only
 * appearing after a client-side fetch. The interactive part (filters,
 * infinite scroll) is in home-client.tsx.
 */
import { unstable_cache } from "next/cache";
import { ItemService } from "@/lib/services/item-service";
import { HomeClient } from "./home-client";

// ItemService.getItems({}) is a Supabase RPC (search_items) that, without a
// cache, used to re-run EVERY TIME — not just on the first load, but on
// every navigation to "/" (e.g. home → QR → home) — taking 400–1200ms,
// which caused loading.tsx (the skeleton) to appear on every navigation,
// even if the user had already seen the home page a few seconds earlier. A
// 15-second cache doesn't eliminate this delay — new listings appear up to
// 15 seconds later (a small cost), but transitions between pages become
// instant.
// `type: "found"` must exactly match the client's DEFAULT filter
// (home-client.tsx). If the server returned a mixed list while the client
// wants only "found", the initial HTML would also show lost listings, and
// the list would jump after hydration.
// The cache key was also changed — otherwise the old mixed list would
// still be served from the Data Cache until the next revalidation.
const getCachedHomeItems = unstable_cache(
  () => ItemService.getItems({ type: "found" }),
  ["home-initial-items-found"],
  { revalidate: 15 },
);

// This page doesn't use any dynamic function (cookies()/headers()/auth()),
// so Next.js renders it statically — the route's own HTML/RSC (Full Route
// Cache) is SEPARATE from the Data Cache of unstable_cache above. Without
// this export, the page's HTML could go stale longer than the internal
// cache's (15s) period — a new listing already exists in the database, but
// the HTML served to new visitors stays stale until the next revalidation
// of the ROUTE (not just the data). The matching revalidate (15s) here
// keeps both layers in sync.
export const revalidate = 15;

export default async function HomePage() {
  let initialItems: Awaited<ReturnType<typeof ItemService.getItems>> = [];
  try {
    initialItems = await getCachedHomeItems();
  } catch {
    // If the server fetch fails, the client fetches on its own —
    // this doesn't block the page from rendering.
  }

  return <HomeClient initialItems={initialItems} />;
}
