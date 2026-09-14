import type { NextConfig } from "next";

type RemotePattern = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>[number];

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const remotePatterns: RemotePattern[] = [
  { protocol: "https", hostname: "img.clerk.com", port: "", pathname: "/**" },
  { protocol: "https", hostname: "placehold.co", port: "", pathname: "/**" },
  {
    protocol: "https",
    hostname: "images.unsplash.com",
    port: "",
    pathname: "/**",
  },
  // Images of listings imported from somon.tj (see scripts/somon-import/).
  { protocol: "https", hostname: "files.somon.tj", port: "", pathname: "/**" },
];

if (supabaseHostname) {
  remotePatterns.push({
    protocol: "https",
    hostname: supabaseHostname,
    port: "",
    pathname: "/storage/v1/object/public/**",
  });
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
  // HSTS: 1 year, include subdomains — forces HTTPS
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  // Prevents base-tag injection attacks
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none';",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Next.js's "Compiling…" indicator in the bottom-left corner. It only
  // exists in dev mode (never visible in production), but on mobile it
  // lands right on top of the navbar and gets in the way of checking the
  // visual appearance — hence disabled.
  devIndicators: false,

  experimental: {
    // Only bundles the icons actually used (not the whole library) —
    // lucide-react and radix are used extensively throughout the app.
    optimizePackageImports: ["lucide-react", "date-fns"],
    // Next.js's default for dynamic pages (all of our pages, since
    // cookies()/auth() are used) is 0 seconds — meaning EVERY navigation
    // (even to a page you viewed a few seconds ago) is forced back to the
    // server and shows loading.tsx, even if React Query has already
    // cached the client-side data (e.g. home → qr → home). 30 seconds was
    // enough for genuinely fast back-and-forth navigation, but in
    // practice a user often spends more than 30 seconds between two
    // visits (e.g. taking a screenshot or reading a chat) — so 5
    // minutes (300 seconds) is a more realistic window for "the same
    // session". Data still stays fresh: React Query/`items-updated`
    // events refresh it behind the scenes, this setting only prevents
    // the loading.tsx flash.
    staleTimes: {
      dynamic: 300,
    },
  },

  images: {
    remotePatterns,
    contentDispositionType: "inline",
    // Vercel's Image Optimization limit (number of unique images per month)
    // ran out (402 Payment Required — OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED)
    // after importing several hundred new images from Telegram. Without the
    // optimizer, images are served directly from their original URL
    // (Supabase Storage/Clerk) — slightly larger in size, but no limit/payment needed.
    unoptimized: true,
  },

  compress: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              source: "/_next/static/(.*)",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
            {
              source: "/(.*)\\.(png|jpg|jpeg|svg|ico|webp|avif|woff2|woff)",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
          ]
        : []),
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/.well-known/web-app-origin-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },

  ...(process.env.NODE_ENV === "development" && {
    logging: { fetches: { fullUrl: false } },
  }),
};

export default nextConfig;
