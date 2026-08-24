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
      appearance={{
        // Ранги брендии JUYO (emerald-500) ба ҷои кабуди пешфарзи Clerk —
        // ин ба ҳамаи компоненти Clerk (SignIn, SignUp ва ғ.) татбиқ мешавад,
        // на танҳо ба саҳифаи ҷорӣ.
        variables: {
          colorPrimary: "#10b981",
          borderRadius: "0.875rem",
        },
        elements: {
          // Талаби корбар: гӯшаҳо мисли inputho бошанд (14px), на тамоман
          // pill (rounded-full) ва на кортаки берунӣ аз ҳад мудаввар.
          formButtonPrimary:
            "!rounded-xl !normal-case !font-bold !shadow-none hover:!bg-emerald-600",
          socialButtonsBlockButton: "!rounded-xl !border-zinc-200 dark:!border-zinc-700",
          formFieldInput: "!rounded-xl !border-zinc-200 dark:!border-zinc-700",
          footerActionLink: "!text-emerald-600 hover:!text-emerald-700",
          identityPreviewEditButton: "!text-emerald-600",
          card: "!rounded-xl",
          cardBox: "!rounded-xl",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
