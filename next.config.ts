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
  // Аксҳои эълонҳои воридшуда аз somon.tj (ниг. scripts/somon-import/).
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

  experimental: {
    // Танҳо icon-ҳои воқеан истифодашударо bundle мекунад (на тамоми
    // китобхонаро) — lucide-react ва radix дар тамоми барнома васеъ
    // истифода мешаванд.
    optimizePackageImports: ["lucide-react", "date-fns"],
    // Пешфарзи Next.js барои саҳифаҳои dynamic (ҳамаи саҳифаҳои мо, чун
    // cookies()/auth() истифода мешавад) = 0 сония — яъне ҲАР гузариш
    // (ҳатто ба саҳифае, ки чанд сония пеш дидаед) маҷбуран ба сервер
    // меравад ва loading.tsx-ро нишон медиҳад, ҳатто агар React Query
    // маълумоти клиентиро аллакай кэш карда бошад (масалан home → qr →
    // home). 30 сония барои гузариши воқеан зуд-зуд кофӣ буд, вале дар
    // амал корбар аксар вақт байни ду ташриф зиёда аз 30 сония сарф
    // мекунад (масалан як screenshot гирифтан ё чат хондан) — пас 5
    // дақиқа (300 сония) доираи воқеан "ҳамин session" аст. Маълумот
    // боз ҳам тоза мемонад: React Query/`items-updated` event-ҳо дар
    // паси парда навсозӣ мекунанд, инҷо танҳо flash-и loading.tsx-ро
    // пешгирӣ мекунад.
    staleTimes: {
      dynamic: 300,
    },
  },

  images: {
    remotePatterns,
    contentDispositionType: "inline",
    // Ҳадди Image Optimization-и Vercel (шумораи аксҳои беназир дар моҳ)
    // тамом шуд (402 Payment Required — OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED)
    // баъд аз воридкунии якчанд садто акси нав аз Telegram. Бе optimizer,
    // аксҳо мустақим аз URL-и аслӣ (Supabase Storage/Clerk) фиристода
    // мешаванд — андозаашон каме калонтар, вале ягон ҳад/пардохт лозим нест.
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
