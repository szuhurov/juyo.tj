/**
 * Саҳифаи воридшавӣ (Sign In Page).
 * Дар ин ҷо корбарон ба профили худ ворид мешаванд (логин мекунанд).
 * Ҳамааш дар асоси Clerk кор мекунад.
 */
"use client";

import { SignIn } from "@clerk/nextjs"; // Барои ворид шудан ба профил
import { useLanguage } from "@/lib/language-context"; // Барои иваз кардани забони сайт
import { Button } from "@/components/ui/button"; // Компоненти тугма

export default function Page() {
  const { locale, setLocale } = useLanguage();

  // Рӯйхати забонҳо барои тугмаҳо
  const languages = [
    { code: "tg", label: "TG" },
    { code: "ru", label: "RU" },
    { code: "en", label: "EN" },
  ];

  return (
    // Контейнер барои марказонидани (center) формаи воридшавӣ
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      
      {/* Қисмати ивази забон */}
      <div className="flex gap-2 mb-8">
        {languages.map((lang) => (
          <Button
            key={lang.code}
            variant={locale === lang.code ? "default" : "outline"}
            size="sm"
            onClick={() => setLocale(lang.code as any)}
            className={`font-black rounded-lg w-12 h-9 transition-all ${
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
        <SignIn />
      </div>
    </div>
  );
}
