/**
 * Sign Up Page.
 * This file is used for creating a new user account with the help of Clerk.
 */
"use client";

import { SignUp } from "@clerk/nextjs";
import { useLanguage, type Locale } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Page() {
  const { t, locale, setLocale } = useLanguage();
  const router = useRouter();

  // List of languages for the buttons
  const languages = [
    { code: "tg", label: "Тоҷикӣ" },
    { code: "ru", label: "Русский" },
    { code: "en", label: "English" },
  ];

  return (
    <main className="min-h-screen flex flex-col items-center bg-white dark:bg-zinc-950 p-4 pt-6 sm:pt-12 relative">
      {/* Top header: Back button and Language switcher */}
      <div className="w-full max-w-[480px] relative flex items-center justify-center mb-8 sm:mb-12">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          aria-label={t("back")}
          className="absolute left-0 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>

        <div className="flex gap-1.5 sm:gap-2">
          {languages.map((lang) => (
            <Button
              key={lang.code}
              variant={locale === lang.code ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setLocale(lang.code as Locale);
              }}
              className={`font-medium rounded-md px-3 sm:px-4 h-8 sm:h-9 transition-all text-[10px] sm:text-xs ${
                locale === lang.code
                  ? "bg-emerald-500 text-white"
                  : "bg-white dark:bg-zinc-900 text-slate-600 hover:text-zinc-900 border-hairline dark:border-zinc-800"
              }`}
            >
              {lang.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="w-full max-w-[480px] -mt-4 sm:-mt-6">
        <div className="flex flex-col items-center">
          <div className="w-full flex justify-center">
            <SignUp
              path="/sign-up"
              routing="path"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/"
              appearance={{
                elements: {
                  card: "w-full shadow-none border-none bg-transparent",
                  rootBox: "w-full",
                  // User request: Clerk's inputs/buttons were too rounded
                  // (Clerk's default) — matched to the same radius as the rest of the
                  // Repeated user request: even less — now matching EXACTLY
                  // the radius of the language selection buttons above
                  // (rounded-md, 10px) — now also what --radius-control
                  // resolves to site-wide, but kept as the literal class here
                  // since Clerk's `appearance` prop doesn't read CSS custom
                  // properties.
                  formFieldInput: "rounded-md",
                  formButtonPrimary: "rounded-md",
                  socialButtonsBlockButton: "rounded-md",
                }
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
