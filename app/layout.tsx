import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { LanguageProvider } from "@/lib/language-context";
import { Toaster } from "@/components/ui/sonner";
import { NetworkStatus } from "@/components/network-status";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

import { QueryProvider } from "@/components/query-provider";
import { translations } from "@/lib/translations";
import { cookies } from "next/headers";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get("juyo-locale")?.value || "tg";
  const locale = ["tg", "ru", "en"].includes(savedLocale) ? savedLocale : "tg";

  const t = translations[locale];

  return {
    title: {
      default: t.seoTitle,
      template: "%s | JUYO.TJ"
    },
    description: t.seoDesc,
    keywords: [
      "juyo", "juyo.tj", "гумшуда", "ёфтшуда", "Тоҷикистон", "Душанбе", 
      "поиск вещей", "бюро находок", "Таджикистан", "потерянные вещи",
      "lost and found Tajikistan", "find lost items", "Dushanbe"
    ],
    authors: [{ name: "JUYO Team" }],
    metadataBase: new URL("https://juyo.tj"),
    alternates: {
      canonical: "/",
      languages: {
        'tg-TJ': '/tg',
        'ru-RU': '/ru',
        'en-US': '/en',
      },
    },
    openGraph: {
      type: "website",
      locale: savedLocale === 'ru' ? 'ru_RU' : savedLocale === 'en' ? 'en_US' : 'tg_TJ',
      url: "https://juyo.tj",
      siteName: "JUYO.TJ",
      title: t.seoTitle,
      description: t.seoDesc,
      images: [
        {
          url: "/logo.png",
          width: 1200,
          height: 630,
          alt: "JUYO.TJ",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t.seoTitle,
      description: t.seoDesc,
      images: ["/logo.png"],
    },
    icons: {
      icon: "/icon.tsx",
    }
  };
}


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${inter.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="min-h-screen bg-white dark:bg-zinc-950 font-sans">
          <QueryProvider>
            <LanguageProvider>
              <NetworkStatus />
              {children}
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
