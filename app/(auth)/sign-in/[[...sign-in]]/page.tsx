/**
 * Sign In Page.
 * This is where users sign in to their profile (log in).
 * Everything runs on top of Clerk.
 */
"use client";

import { SignIn } from "@clerk/nextjs"; // For signing in to the profile
import { useLanguage, type Locale } from "@/lib/language-context"; // For switching the site's language
import { Button } from "@/components/ui/button"; // Button component
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
    // Container for centering the sign-in form
    <main className="min-h-screen flex flex-col items-center bg-zinc-50 dark:bg-zinc-950 p-4 pt-6 sm:pt-12">

      {/* Top header: Back button and Language switcher */}
      <div className="w-full max-w-[480px] relative flex items-center justify-center mb-10 sm:mb-14">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          aria-label={t("back")}
          className="absolute left-0 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 shrink-0"
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
              className={`font-bold rounded-lg px-3 sm:px-4 h-8 sm:h-9 transition-all text-[10px] sm:text-xs ${
                locale === lang.code
                  ? "bg-emerald-500 text-white"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 hover:text-zinc-900 border-zinc-200 dark:border-zinc-800"
              }`}
            >
              {lang.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Clerk's ready-made widget for login */}
      <div className="w-full max-w-[480px] flex justify-center -mt-4 sm:-mt-6">
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/"
          appearance={{
            elements: {
              card: "w-full shadow-none border-none bg-transparent",
              rootBox: "w-full",
              // User request: Clerk's inputs/buttons were too rounded
              // (Clerk's default) — matched to the same radius as the rest of the
              // Repeated user request: even less — now matching EXACTLY
              // the radius of the language selection buttons above
              // (rounded-lg, 8px), not --radius-control (14px).
              formFieldInput: "rounded-lg",
              formButtonPrimary: "rounded-lg",
              socialButtonsBlockButton: "rounded-lg",
            }
          }}
        />
      </div>
    </main>
  );
}
