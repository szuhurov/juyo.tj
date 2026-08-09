/**
 * Тарҳбандии асосии барнома (Root Layout), ки сохтори умумии HTML-ро муайян мекунад.
 * Дар ин ҷо таъминкунандагони (providers) глобалӣ ва метамаълумоти SEO танзим карда мешаванд.
 * Test commit: git push санҷиш.
 */
import type { Viewport } from "next"; // Барои танзими маълумоти SEO ва экран
import { Nunito } from "next/font/google"; // Барои истифодаи шрифти Nunito
import "./globals.css"; // Пайваст кардани услубҳои асосии CSS
import { LanguageProvider, type Locale } from "@/lib/language-context"; // Барои идоракунии забони тамоми сайт
import { Toaster } from "@/components/ui/sonner"; // Барои нишон додани огоҳиномаҳо дар экран
import { NetworkStatus } from "@/components/network-status"; // Барои санҷиши пайвастшавӣ ба интернет
import { Analytics } from "@vercel/analytics/react"; // Барои ҷамъоварии омори истифодабарандагон
import { SpeedInsights } from "@vercel/speed-insights/next"; // Барои назорати суръати кори сайт
import { ClerkLocalizationProvider } from "@/components/clerk-localization-provider";
import { QueryProvider } from "@/components/query-provider"; // Барои идоракунии запросҳо ба сервер
import { AdsenseScript } from "@/components/adsense-script";
import { translations } from "@/lib/translations"; // Барои дастрасӣ ба тарҷумаҳои сайт
import { cookies } from "next/headers"; // Барои кор бо кукиҳои браузер
import Script from "next/script";

// Nunito — мудаввар, дӯстона, ба SF Compact Rounded монанд; дастгирии
// пурраи алифбои лотинӣ ва кирилӣ (тоҷикӣ/русӣ/англисӣ дар як фонт).
const nunito = Nunito({
  subsets: ["latin", "cyrillic"],
  variable: "--font-nunito",
});

/**
 * Функсия барои тавлиди динамикии метамаълумот вобаста ба забони интихобшудаи корбар.
 * Ин барои беҳтар кардани SEO дар забонҳои тоҷикӣ, русӣ ва англисӣ хидмат мекунад.
 */
export async function generateMetadata() {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get("juyo-locale")?.value || "tg";

  return {
    title: {
      default: "juyo",
      template: "%s",
    },
    description:
      "Барнома барои эълон гузоштан ва ёфтани ашёҳои гумшуда ва ёфтшуда дар Тоҷикистон.",
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "juyo",
    },
    keywords: [
      "juyo",
      "juyo.tj",
      "гумшуда",
      "ёфтшуда",
      "Тоҷикистон",
      "Душанбе",
      "поиск вещей",
      "бюро находок",
      "Таджикистан",
      "потерянные вещи",
      "lost and found Tajikistan",
      "find lost items",
      "Dushanbe",
    ],
    applicationName: "juyo",
    authors: [{ name: "juyo team" }],
    verification: {
      google: "OlHxk_CFMu0ekUQbcbj9aaTRk4bn_kCIoR_7PCNO8L4",
    },
    other: { "google-adsense-account": "ca-pub-2002195129032167" },
    metadataBase: new URL("https://juyo.tj"),
    alternates: {
      canonical: "/",
      languages: { "tg-TJ": "/tg", "ru-RU": "/ru", "en-US": "/en" },
    },
    openGraph: {
      type: "website",
      locale:
        savedLocale === "ru"
          ? "ru_RU"
          : savedLocale === "en"
            ? "en_US"
            : "tg_TJ",
      url: "https://juyo.tj",
      siteName: "juyo",
      title: "juyo",
      description:
        "Барнома барои эълон гузоштан ва ёфтани ашёҳои гумшуда ва ёфтшуда дар Тоҷикистон.",
      images: [
        {
          url: "https://juyo.tj/juyo-logo.jpg",
          width: 1200,
          height: 630,
          alt: "juyo.tj — Ашёҳои гумшуда ва ёфтшуда дар Тоҷикистон",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "juyo",
      description:
        "Барнома барои эълон гузоштан ва ёфтани ашёҳои гумшуда ва ёфтшуда дар Тоҷикистон.",
      images: ["https://juyo.tj/juyo-logo.jpg"],
    },
    icons: {
      icon: [
        { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
        { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      ],
      shortcut: "/icon-192.png",
      apple: [
        { url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
      ],
    },
  };
}

/**
 * Танзимоти намоиш (Viewport) барои таъмини мутобиқат бо дастгоҳҳои мобилӣ.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // `maximumScale`/`userScalable: false` пештар зум-ро пурра манъ мекард —
  // WCAG 1.4.4-ро вайрон мекунад (корбарони бинои заиф наметавонанд калон
  // кунанд). Ҳадди 5x кофист барои пешгирии зуми тасодуфӣ, вале ҳамзамон
  // ба талаботи дастрасӣ ҷавобгӯ мебошад.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#ffffff" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get("juyo-locale")?.value || "tg";
  const locale = ["tg", "ru", "en"].includes(savedLocale) ? savedLocale : "tg";
  const t = translations[locale];

  return (
    <html
      lang={locale}
      className={`${nunito.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": "https://juyo.tj/#website",
                  name: "juyo",
                  alternateName: "juyo.tj",
                  url: "https://juyo.tj",
                  description: t.seoDesc,
                  inLanguage: ["tg", "ru", "en"],
                  potentialAction: {
                    "@type": "SearchAction",
                    target: {
                      "@type": "EntryPoint",
                      urlTemplate: "https://juyo.tj/?q={search_term_string}",
                    },
                    "query-input": "required name=search_term_string",
                  },
                },
                {
                  "@type": "Organization",
                  "@id": "https://juyo.tj/#organization",
                  name: "juyo",
                  url: "https://juyo.tj",
                  logo: {
                    "@type": "ImageObject",
                    url: "https://juyo.tj/juyo-logo.jpg",
                    width: 512,
                    height: 512,
                  },
                  areaServed: { "@type": "Country", name: "Tajikistan" },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-white dark:bg-zinc-950 font-sans">
        <LanguageProvider initialLocale={locale as Locale}>
          <ClerkLocalizationProvider>
            {/* Матни махфӣ барои Google, то ба ҷои номҳои меню тавсифи сайтро нишон диҳад.
                Дар div-и бо role="region" печонда шудааст (на худи h1), то ки
                a) axe/screen reader онро ҳамчун landmark-и дуруст шиносад,
                б) семантикаи "heading"-и худи h1 бетаъсир монад. */}
            <div role="region" aria-label="JUYO">
              <h1 className="sr-only">
                роҳи зуд барои пайдо кардан ва баргардонидани ашёҳои гумшуда дар
                Тоҷикистон. Дар ин барнома одамоне, ки ашё ёфтаанд ва одамоне, ки
                ашёи худро гум кардаанд, метавонанд эълон гузошта бо ҳамдигар
                иртибот пайдо кунанд. Ҳамчунин имкон ҳаст, ки QR-коди шахсӣ ба
                ашёҳои арзишманд часпонда шавад, то дар ҳолати гум шудан,
                ёбандагон зуд тамос гирифта, онро баргардонанд.
              </h1>
            </div>
            <QueryProvider>
              {children}
              <NetworkStatus />
              <Analytics />
              <SpeedInsights />
              <Toaster position="top-center" richColors />
            </QueryProvider>
          </ClerkLocalizationProvider>
        </LanguageProvider>
        {process.env.NODE_ENV === "production" ? (
          <Script
            id="sw-register"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `if ('serviceWorker'in navigator) { window.addEventListener('load', function() { navigator.serviceWorker.register('/sw.js'); }); }`,
            }}
          />
        ) : (
          // Дар dev ҳеҷ гоҳ SW-ро сабт накун — агар аз пеш сабт шуда бошад
          // (масалан аз production build-и қаблӣ), онро худкор нест кун,
          // то кэши SW тағйиротро дар вақти рушд пинҳон накунад.
          <Script
            id="sw-unregister-dev"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `if ('serviceWorker'in navigator) { navigator.serviceWorker.getRegistrations().then(function(regs) { regs.forEach(function(r) { r.unregister(); }); }); if (window.caches) { caches.keys().then(function(keys) { keys.forEach(function(k) { caches.delete(k); }); }); } }`,
            }}
          />
        )}
        <AdsenseScript />
      </body>
    </html>
  );
}
