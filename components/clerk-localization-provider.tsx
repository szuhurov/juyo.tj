"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { getClerkLocalization } from "@/lib/clerk-localization";
import { useMemo } from "react";

/**
 * Варақаи мизоҷӣ (Client Wrapper) барои ClerkProvider.
 * Ин имкон медиҳад, ки забони Clerk лаҳзавӣ (instant) иваз шавад,
 * зеро он ба тағйироти LanguageContext гӯш медиҳад.
 */
export function ClerkLocalizationProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLanguage();
  
  // Ҳисобкунии тарҷумаи Clerk ҳангоми иваз шудани забон
  const localization = useMemo(() => getClerkLocalization(locale), [locale]);

  return (
    <ClerkProvider
      localization={localization}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      {children}
    </ClerkProvider>
  );
}
