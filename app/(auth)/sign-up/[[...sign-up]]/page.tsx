/**
 * Саҳифаи бақайдгирӣ (Sign Up Page).
 * Ин файл барои сохтани аккаунти нави корбар бо ёрии Clerk хизмат мекунад.
 */
"use client";

import { SignUp } from "@clerk/nextjs";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { getClerkLocalization } from "@/lib/clerk-localization";

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
    <div className="min-h-screen flex flex-col items-center bg-white dark:bg-zinc-950 p-4 pt-6 sm:pt-12 relative">
      {/* Сарлавҳаи боло: Тугмаи Ба қафо ва Ивази забон */}
      <div className="w-full max-w-[420px] relative flex items-center justify-center mb-8 sm:mb-12">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.back()}
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
                setLocale(lang.code as any);
                router.refresh();
              }}
              className={`font-bold rounded-lg px-3 sm:px-4 h-8 sm:h-9 transition-all text-[10px] sm:text-xs ${
                locale === lang.code
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 hover:text-zinc-900 border-zinc-200 dark:border-zinc-800"
              }`}
            >
              {lang.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="w-full max-w-[420px] -mt-4 sm:-mt-6">
        <div className="animate-in fade-in zoom-in-95 duration-700 flex flex-col items-center">
          <div className="w-full flex justify-center">
            <SignUp
              signInUrl="/sign-in"
              appearance={{
                // Танзимоти намуди зоҳирӣ агар лозим бошад
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
