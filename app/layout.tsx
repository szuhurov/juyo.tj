import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { LanguageProvider } from "@/lib/language-context";
import { Toaster } from "@/components/ui/sonner";
import { NetworkStatus } from "@/components/network-status";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "JUYO - Lost and Found",
  description: "Platform for lost and found items in Tajikistan",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { QueryProvider } from "@/components/query-provider";

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
              <Toaster position="top-center" richColors />
            </LanguageProvider>
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
