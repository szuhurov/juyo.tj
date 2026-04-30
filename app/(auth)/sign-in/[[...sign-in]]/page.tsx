/**
 * Саҳифаи воридшавӣ (Sign In Page).
 * Дар ин ҷо корбарон ба профили худ ворид мешаванд (логин мекунанд).
 * Ҳамааш дар асоси Clerk кор мекунад.
 */
"use client";

import { SignIn } from "@clerk/nextjs"; // Барои ворид шудан ба профил
import { useLanguage } from "@/lib/language-context"; // Барои иваз кардани забони сайт
import { Button } from "@/components/ui/button"; // Компоненти тугма
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
    // Контейнер барои марказонидани (center) формаи воридшавӣ
    <div className="min-h-screen flex flex-col items-center justify-center  bg-zinc-50 dark:bg-zinc-950 p-4 relative">
      {/* Тугмаи Ба қафо */}
      <div className="absolute top-6 left-4 sm:left-8">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.back()}
          className="rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
      </div>

      {/* Қисмати ивази забон */}
      <div className="flex gap-2 mb-8">
        {languages.map((lang) => (
          <Button
            key={lang.code}
            variant={locale === lang.code ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setLocale(lang.code as any);
              // Забонро дар куки захира мекунем ва саҳифаро нав мекунем
              setTimeout(() => window.location.reload(), 100);
            }}
            className={`font-bold rounded-lg px-4 h-9 transition-all text-[11px] sm:text-xs ${
              locale === lang.code
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md"
                : "bg-white dark:bg-zinc-900 text-zinc-600 hover:text-zinc-900 border-zinc-200 dark:border-zinc-800"
            }`}
          >
            {lang.label}
          </Button>
        ))}
      </div>

      {/* Виҷети тайёри Clerk барои логин */}
      <div className="w-full max-w-[400px] flex justify-center">
        <SignIn
          signUpUrl="/sign-up"
          appearance={{
            theme: "simple",
          }}
        />{" "}
      </div>
    </div>
  );
}
