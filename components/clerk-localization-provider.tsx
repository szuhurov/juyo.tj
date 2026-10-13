"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { getClerkLocalization } from "@/lib/clerk-localization";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { clerkNeedsUi } from "@/lib/clerk-ui";

/**
 * Client Wrapper for ClerkProvider.
 * This allows Clerk's language to switch instantly, since it listens
 * for changes to LanguageContext.
 */
export function ClerkLocalizationProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLanguage();
  
  // Recompute Clerk's localization when the language changes
  const localization = useMemo(() => getClerkLocalization(locale), [locale]);

  // Clerk's prebuilt screens (sign-in, sign-up, account settings) need its UI
  // bundle — over 1 MB of script that Clerk otherwise downloads and runs on
  // every page, and waits for before it reports the session. Clerk reads this
  // once, when it loads, so the answer is fixed at the first render.
  const pathname = usePathname();
  const [withUi] = useState(() => clerkNeedsUi(pathname));
  // Arrived at one of those screens from a page that loaded Clerk without its
  // UI: load the page properly, once (after that the first render says yes).
  useEffect(() => {
    if (!withUi && clerkNeedsUi(pathname)) window.location.reload();
  }, [withUi, pathname]);

  return (
    <ClerkProvider
      prefetchUI={withUi}
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
            "!rounded-md !normal-case !font-medium !shadow-none hover:!bg-emerald-600",
          socialButtonsBlockButton: "!rounded-md !border-zinc-200 dark:!border-zinc-700",
          formFieldInput: "!rounded-md !border-zinc-200 dark:!border-zinc-700",
          footerActionLink: "!text-emerald-600 hover:!text-emerald-700",
          identityPreviewEditButton: "!text-emerald-600",
          card: "!rounded-md",
          cardBox: "!rounded-md",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
