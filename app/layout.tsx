/**
 * The app's root layout, which defines the overall HTML structure.
 * Global providers and SEO metadata are configured here.
 * Test commit: git push test.
 */
import type { Viewport } from "next"; // For configuring SEO and viewport data
import { Nunito } from "next/font/google"; // For using the Nunito font
import "./globals.css"; // Import the main CSS styles
import { LanguageProvider, type Locale } from "@/lib/language-context"; // For managing the site's language
import { Toaster } from "@/components/ui/sonner"; // For showing on-screen notifications
import { NetworkStatus } from "@/components/network-status"; // For checking internet connectivity
import { Analytics } from "@vercel/analytics/react"; // For collecting user analytics
import { SpeedInsights } from "@vercel/speed-insights/next"; // For monitoring site performance
import { ClerkLocalizationProvider } from "@/components/clerk-localization-provider";
import { QueryProvider } from "@/components/query-provider"; // For managing requests to the server
import { ThemeProvider } from "@/components/theme-provider"; // Light / dark / system
import { translations } from "@/lib/translations"; // For accessing site translations
import { cookies } from "next/headers"; // For working with browser cookies
import Script from "next/script";

// Nunito — rounded, friendly, similar to SF Compact Rounded; full
// support for both Latin and Cyrillic (Tajik/Russian/English in one font).
const nunito = Nunito({
  subsets: ["latin", "cyrillic"],
  variable: "--font-nunito",
});

/**
 * Function for dynamically generating metadata based on the user's selected language.
 * This serves to improve SEO in Tajik, Russian, and English.
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
 * Viewport configuration for ensuring compatibility with mobile devices.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // `maximumScale`/`userScalable: false` previously disabled zoom entirely —
  // that violates WCAG 1.4.4 (users with low vision can't zoom in).
  // A cap of 5x is enough to prevent accidental zooming while still
  // meeting accessibility requirements.
  maximumScale: 5,
  // Color of the browser/PWA system bar. Both used to be white —
  // in dark mode the bar stayed white and clashed with the site.
  // Values = --canvas for each theme.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#17212b" },
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
      <body className="min-h-screen bg-canvas font-sans">
        <ThemeProvider>
        <LanguageProvider initialLocale={locale as Locale}>
          <ClerkLocalizationProvider>
            {/* Hidden text for Google, so it shows the site description instead of menu names.
                Wrapped in a div with role="region" (not the h1 itself), so that
                a) axe/screen readers recognize it as a proper landmark,
                b) the h1's own "heading" semantics stay unaffected. */}
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
        </ThemeProvider>
        {process.env.NODE_ENV === "production" ? (
          <Script
            id="sw-register"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `if ('serviceWorker'in navigator) { window.addEventListener('load', function() { navigator.serviceWorker.register('/sw.js'); }); }`,
            }}
          />
        ) : (
          // Never register the SW in dev — if it was already registered
          // (e.g. from a previous production build), automatically unregister it,
          // so the SW cache doesn't hide changes during development.
          <Script
            id="sw-unregister-dev"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `if ('serviceWorker'in navigator) { navigator.serviceWorker.getRegistrations().then(function(regs) { regs.forEach(function(r) { r.unregister(); }); }); if (window.caches) { caches.keys().then(function(keys) { keys.forEach(function(k) { caches.delete(k); }); }); } }`,
            }}
          />
        )}
      </body>
    </html>
  );
}
