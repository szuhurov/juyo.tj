import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const isProtectedRoute = createRouteMatcher([
  "/profile(.*)",
  "/items/add",
  "/items/(.*)/edit",
]);

// Rate limit rules: [path prefix, requests per window, window ms]
const RATE_RULES: Array<{ prefix: string; limit: number; windowMs: number }> = [
  { prefix: "/items/add",    limit: 10,  windowMs: 60_000 },  // 10 item uploads/min
  { prefix: "/api/",         limit: 60,  windowMs: 60_000 },  // 60 API calls/min
  { prefix: "/",             limit: 200, windowMs: 60_000 },  // 200 page views/min
];

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export default clerkMiddleware(async (auth, request) => {
  const ip = getClientIp(request);
  const path = new URL(request.url).pathname;

  // Find the most specific matching rule
  const rule = RATE_RULES.find(r => path.startsWith(r.prefix)) ?? RATE_RULES[RATE_RULES.length - 1];
  const key = `${rule.prefix}:${ip}`;

  if (!(await rateLimit(key, rule.limit, rule.windowMs))) {
    return new NextResponse(
      JSON.stringify({ error: "Too Many Requests", retryAfter: Math.ceil(rule.windowMs / 1000) }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(rule.windowMs / 1000)),
          "X-RateLimit-Limit": String(rule.limit),
        },
      }
    );
  }

  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
