/**
 * Тарҳбандии асосии барнома (Root Layout), ки сохтори умумии HTML-ро муайян мекунад.
 * Дар ин ҷо таъминкунандагони (providers) глобалӣ ва метамаълумоти SEO танзим карда мешаванд.
 */
import type { Metadata, Viewport } from "next"; // Барои танзими маълумоти SEO ва экран
import { Inter } from "next/font/google"; // Барои истифодаи шрифти Inter
import "./globals.css"; // Пайваст кардани услубҳои асосии CSS
import { ClerkProvider } from "@clerk/nextjs"; // Барои кор бо системаи аутентификатсия
import { LanguageProvider } from "@/lib/language-context"; // Барои идоракунии забони тамоми сайт
import { Toaster } from "@/components/ui/sonner"; // Барои нишон додани огоҳиномаҳо дар экран
import { NetworkStatus } from "@/components/network-status"; // Барои санҷиши пайвастшавӣ ба интернет
import { Analytics } from "@vercel/analytics/react"; // Барои ҷамъоварии омори истифодабарандагон
import { SpeedInsights } from "@vercel/speed-insights/next"; // Барои назорати суръати кори сайт

// Танзимоти ҳуруфи Inter бо дастгирии алифбои лотинӣ ва кирилӣ
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});
import { QueryProvider } from "@/components/query-provider"; // Барои идоракунии запросҳо ба сервер
import { translations } from "@/lib/translations"; // Барои дастрасӣ ба тарҷумаҳои сайт
import { cookies } from "next/headers"; // Барои кор бо кукиҳои браузер
import { getClerkLocalization } from "@/lib/clerk-localization"; // Функсияи тарҷумаи Clerk
import NextTopLoader from "nextjs-toploader"; // Барои нишон додани хати боргирӣ дар боло

/**
 * Функсия барои тавлиди динамикии метамаълумот вобаста ба забони интихобшудаи корбар.
 * Ин барои беҳтар кардани SEO дар забонҳои тоҷикӣ, русӣ ва англисӣ хидмат мекунад.
 */
export async function generateMetadata() {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get("juyo-locale")?.value || "tg";
  const locale = ["tg", "ru", "en"].includes(savedLocale) ? savedLocale : "tg";

  const t = translations[locale];

  return {
    title: {
      default: t.seoTitle,
      template: "%s | juyo",
    },
    description: t.seoDesc,
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
    authors: [{ name: "JUYO Team" }],
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
      siteName: "JUYO",
      title: t.seoTitle,
      description: t.seoDesc,
      images: [
        {
          url: "https://juyo.tj/logo.png",
          width: 1200,
          height: 630,
          alt: "JUYO.TJ - Платформаи ёфтани ашёҳои гумшуда ва ёфтшуда",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t.seoTitle,
      description: t.seoDesc,
      images: ["https://juyo.tj/logo.png"],
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/logo.png", type: "image/png", sizes: "512x512" },
      ],
      shortcut: "/favicon.ico",
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
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
  const clerkLocale = getClerkLocalization(locale);
  const t = translations[locale];

  return (
    <ClerkProvider
      localization={clerkLocale}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <html
        lang={locale}
        className={`${inter.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "JUYO",
                "url": "https://juyo.tj",
                "description": t.seoDesc,
              }),
            }}
          />
        </head>
        <body className="min-h-screen bg-white dark:bg-zinc-950 font-sans">
          <NextTopLoader 
            color="#22C55E"
            initialPosition={0.05}
            crawlSpeed={200}
            height={3}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={500}
            shadow="0 0 10px #22C55E,0 0 5px #22C55E"
          />
          <QueryProvider>
            <LanguageProvider initialLocale={locale as any}>
              {children}
              <NetworkStatus />
              <Analytics />
              <SpeedInsights />
              <Toaster position="top-center" richColors />
            </LanguageProvider>
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
