/**
 * Тарҳбандии асосии барнома (Root Layout), ки сохтори умумии HTML-ро муайян мекунад.
 * Дар ин ҷо таъминкунандагони (providers) глобалӣ ва метамаълумоти SEO танзим карда мешаванд.
 */
import type { Viewport } from "next"; // Барои танзими маълумоти SEO ва экран
import { Inter } from "next/font/google"; // Барои истифодаи шрифти Inter
import "./globals.css"; // Пайваст кардани услубҳои асосии CSS
import { LanguageProvider } from "@/lib/language-context"; // Барои идоракунии забони тамоми сайт
import { Toaster } from "@/components/ui/sonner"; // Барои нишон додани огоҳиномаҳо дар экран
import { NetworkStatus } from "@/components/network-status"; // Барои санҷиши пайвастшавӣ ба интернет
import { Analytics } from "@vercel/analytics/react"; // Барои ҷамъоварии омори истифодабарандагон
import { SpeedInsights } from "@vercel/speed-insights/next"; // Барои назорати суръати кори сайт
import { ClerkLocalizationProvider } from "@/components/clerk-localization-provider";
import { QueryProvider } from "@/components/query-provider"; // Барои идоракунии запросҳо ба сервер
import { translations } from "@/lib/translations"; // Барои дастрасӣ ба тарҷумаҳои сайт
import { cookies } from "next/headers"; // Барои кор бо кукиҳои браузер
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";

// Танзимоти ҳуруфи Inter бо дастгирии алифбои лотинӣ ва кирилӣ
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
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
    description: "",
    manifest: "/manifest.json",
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#ffffff" },
      { media: "(prefers-color-scheme: dark)", color: "#ffffff" },
    ],
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
    metadataBase: new URL("https://juyo.tj"),
    alternates: {
      canonical: "/",
      languages: {
        "tg-TJ": "/tg",
        "ru-RU": "/ru",
        "en-US": "/en",
      },
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
      description: "",
      images: [
        {
          url: "https://juyo.tj/juyo-logo.jpg",
          width: 1200,
          height: 630,
          alt: "JUYO.TJ - Платформаи ёфтани ашёҳои гумшуда ва ёфтшуда",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "juyo",
      description: "",
      images: ["https://juyo.tj/juyo-logo.jpg"],
    },
    icons: {
      icon: [
        { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
        { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
        { url: "/favicon.ico", sizes: "any" },
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
  maximumScale: 1,
  userScalable: false,
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
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function() { navigator.serviceWorker.register('/sw.js'); }); }`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": "https://juyo.tj/#website",
                  "name": "juyo",
                  "alternateName": "juyo.tj",
                  "url": "https://juyo.tj",
                  "description": t.seoDesc,
                  "inLanguage": ["tg", "ru", "en"],
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": {
                      "@type": "EntryPoint",
                      "urlTemplate": "https://juyo.tj/?q={search_term_string}",
                    },
                    "query-input": "required name=search_term_string",
                  },
                },
                {
                  "@type": "Organization",
                  "@id": "https://juyo.tj/#organization",
                  "name": "juyo",
                  "url": "https://juyo.tj",
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://juyo.tj/juyo-logo.jpg",
                    "width": 512,
                    "height": 512,
                  },
                  "areaServed": {
                    "@type": "Country",
                    "name": "Tajikistan",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-white dark:bg-zinc-950 font-sans">
        <LanguageProvider initialLocale={locale as any}>
          <ClerkLocalizationProvider>
            {/* Матни махфӣ барои Google, то ба ҷои номҳои меню тавсифи сайтро нишон диҳад */}
            <h1 className="sr-only">
              роҳи зуд барои пайдо кардан ва баргардонидани ашёҳои гумшуда дар Тоҷикистон. 
              Дар ин барнома одамоне, ки ашё ёфтаанд ва одамоне, ки ашёи худро гум кардаанд, 
              метавонанд эълон гузошта бо ҳамдигар иртибот пайдо кунанд. 
              Ҳамчунин имкон ҳаст, ки QR-коди шахсӣ ба ашёҳои арзишманд часпонда шавад, 
              то дар ҳолати гум шудан, ёбандагон зуд тамос гирифта, онро баргардонанд.
            </h1>
            <QueryProvider>
              {children}
              <NetworkStatus />
              <Analytics />
              <SpeedInsights />
              <Toaster position="top-center" richColors />
              <PWAInstallPrompt />
            </QueryProvider>
          </ClerkLocalizationProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
