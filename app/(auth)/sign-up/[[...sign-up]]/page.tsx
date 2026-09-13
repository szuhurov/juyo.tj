/**
 * Саҳифаи бақайдгирӣ (Sign Up Page).
 * Ин файл барои сохтани аккаунти нави корбар бо ёрии Clerk хизмат мекунад.
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

  // Рӯйхати забонҳо барои тугмаҳо
  const languages = [
    { code: "tg", label: "Тоҷикӣ" },
    { code: "ru", label: "Русский" },
    { code: "en", label: "English" },
  ];

  return (
    <main className="min-h-screen flex flex-col items-center bg-white dark:bg-zinc-950 p-4 pt-6 sm:pt-12 relative">
      {/* Сарлавҳаи боло: Тугмаи Ба қафо ва Ивази забон */}
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
                  // Талаби корбар: input/тугмаҳои Clerk аз ҳад зиёд rounded
                  // буданд (пешфарзи Clerk) — ба ҳамон радиуси боқии
                  // input/тугмаҳои барнома (`--radius-control`, 14px) мутобиқ карда шуд.
                  formFieldInput: "rounded-[var(--radius-control)]",
                  formButtonPrimary: "rounded-[var(--radius-control)]",
                  socialButtonsBlockButton: "rounded-[var(--radius-control)]",
                }
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
