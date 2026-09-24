import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin-auth";

const isProtectedRoute = createRouteMatcher([
  "/profile(.*)",
  "/items/add",
  "/items/(.*)/edit",
  "/admin(.*)",
  "/api/admin(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);

/**
 * Rate limit for routes that expose contact info (phone number):
 * `/qr/<id>`, `/q/<code>`, `/items/<id>`. This is an ADDITIONAL layer of
 * protection — the MAIN protection (after migration 20260824020000) is
 * at the Supabase RLS/RPC level, since a scraper can go directly to
 * Supabase's REST/RPC endpoints, not only through these Next.js routes.
 * Here we're only slowing down "looping through thousands of pages
 * one by one".
 *
 * NOTE: this is in-memory. Vercel's Edge runtime can have several
 * parallel instances (different regions, cold starts) — so this is NOT
 * 100% protection, but a real obstacle for a simple single-threaded
 * scraper. Full distributed protection isn't possible without
 * Redis/Upstash (or Vercel Firewall at the dashboard level).
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimitHits = new Map<string, { count: number; resetAt: number }>();

/**
 * SECURITY GAP FOUND (audit): `/api/account/request-deletion` is public and
 * unauthenticated by design (Google Play Data Safety requires it to work
 * without sign-in), and `/api/items/moderate` triggers a paid OpenAI call —
 * neither was covered by the contact-route limiter below. Same in-memory
 * mechanism, a separate (tighter) bucket, since these are action endpoints,
 * not page loads.
 */
const LIMITED_ACTION_WINDOW_MS = 60_000;
const LIMITED_ACTION_MAX = 10;
const limitedActionHits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(request: Request, path: string): boolean {
  const isContactRoute =
    path.startsWith("/qr/") ||
    path.startsWith("/q/") ||
    (path.startsWith("/items/") && path !== "/items/add" && !/^\/items\/[^/]+\/edit$/.test(path));
  if (!isContactRoute) return false;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  // Grouped by the route's area (not the ID), so the count accumulates
  // across different pages of the same type (this is exactly how a scraper behaves).
  const bucket = path.startsWith("/qr/") ? "qr" : path.startsWith("/q/") ? "q" : "items";
  const key = `${ip}:${bucket}`;
  const now = Date.now();

  if (rateLimitHits.size > 5000) {
    for (const [k, v] of rateLimitHits) if (now > v.resetAt) rateLimitHits.delete(k);
  }

  const hit = rateLimitHits.get(key);
  if (!hit || now > hit.resetAt) {
    rateLimitHits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  hit.count += 1;
  return hit.count > RATE_LIMIT_MAX;
}

// Exported for tests/middleware.test.ts — same reasoning as the rest of this
// file: in-memory only, not distributed, but a real obstacle either way.
export function isLimitedActionRateLimited(request: Request, path: string): boolean {
  const isLimitedAction =
    path === "/api/account/request-deletion" || path === "/api/items/moderate";
  if (!isLimitedAction) return false;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const key = `${ip}:${path}`;
  const now = Date.now();

  if (limitedActionHits.size > 5000) {
    for (const [k, v] of limitedActionHits) if (now > v.resetAt) limitedActionHits.delete(k);
  }

  const hit = limitedActionHits.get(key);
  if (!hit || now > hit.resetAt) {
    limitedActionHits.set(key, { count: 1, resetAt: now + LIMITED_ACTION_WINDOW_MS });
    return false;
  }
  hit.count += 1;
  return hit.count > LIMITED_ACTION_MAX;
}

export default clerkMiddleware(async (auth, request) => {
  const path = new URL(request.url).pathname;

  if (isRateLimited(request, path) || isLimitedActionRateLimited(request, path)) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  if (isAdminRoute(request)) {
    const { userId } = await auth();
    if (!isAdminUser(userId)) {
      return path.startsWith("/api/admin")
        ? NextResponse.json({ error: "Not found" }, { status: 404 })
        : NextResponse.redirect(new URL("/", request.url));
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|.well-known|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
