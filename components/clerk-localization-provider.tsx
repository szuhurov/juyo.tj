"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { getClerkLocalization } from "@/lib/clerk-localization";
import { useMemo } from "react";

/**
 * Client Wrapper for ClerkProvider.
 * This allows Clerk's language to switch instantly, since it listens
 * for changes to LanguageContext.
 */
export function ClerkLocalizationProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLanguage();
  
  // Recompute Clerk's localization when the language changes
  const localization = useMemo(() => getClerkLocalization(locale), [locale]);

  return (
    <ClerkProvider
      localization={localization}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      appearance={{
        // JUYO's brand color (emerald-500) instead of Clerk's default blue —
        // this applies to all Clerk components (SignIn, SignUp, etc.),
        // not just the current page.
        variables: {
          colorPrimary: "#10b981",
          borderRadius: "0.875rem",
        },
        elements: {
          // User request: corners should match the inputs (14px), neither
          // fully pill-shaped (rounded-full) nor the outer card overly rounded.
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
