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
 * Rate limit барои масирҳое, ки маълумоти тамос (рақами телефон) медиҳанд:
 * `/qr/<id>`, `/q/<code>`, `/items/<id>`. Ин ҳимояи ИЛОВАГӢ аст — ҳимояи
 * АСОСӢ (пас аз миграцияи 20260824020000) дар сатҳи RLS/RPC-и Supabase
 * аст, чунки scraper метавонад бевосита ба REST/RPC-и Supabase равад, на
 * танҳо ба ин масирҳои Next.js. Ин ҷо мо танҳо "як-як тамошои ҳазорон
 * саҳифа дар лоуп"-ро сусттар мекунем.
 *
 * ДИҚҚАТ: дар-ҳофиза (in-memory) аст. Edge runtime-и Vercel метавонад
 * якчанд нусхаи параллел дошта бошад (минтақаҳои гуногун, cold start) —
 * пас ин 100% муҳофизат НЕСТ, балки монеаи воқеӣ барои scraper-и оддии
 * якхаттагӣ. Муҳофизати пурраи тақсимшуда бидуни Redis/Upstash (ё
 * Vercel Firewall дар сатҳи dashboard) имконнопазир аст.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimitHits = new Map<string, { count: number; resetAt: number }>();

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
  // Аз рӯи ноҳияи масир (na ID) гурӯҳбандӣ мешавад, то шумориш дар байни
  // саҳифаҳои гуногуни ҳамон навъ ҷамъ шавад (ин маҳз рафтори scraper аст).
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

export default clerkMiddleware(async (auth, request) => {
  const path = new URL(request.url).pathname;

  if (isRateLimited(request, path)) {
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
