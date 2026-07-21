"use client";

/**
 * Скрипти AdSense Auto Ads — дар саҳифаҳои шахсӣ/хидматӣ (ҳамон рӯйхате, ки
 * robots.ts аллакай аз индексатсия истисно кардааст) бор НАМЕШАВАД, чунки
 * алгоритми Auto Ads-и Google дар ин ҷойҳо (масалан таби QR-и профил, дар
 * andozahoi mobile) реклама/spinner-и худро ба миёни интерфейси функсионалӣ
 * ҷойгир мекард.
 */
import Script from "next/script";
import { usePathname } from "next/navigation";

const ADS_EXCLUDED_PREFIXES = ["/profile", "/sign-in", "/sign-up", "/qr/"];

export function AdsenseScript() {
  const pathname = usePathname();
  const isExcluded = ADS_EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isExcluded) return null;

  return (
    <Script
      id="adsense"
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2002195129032167"
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
