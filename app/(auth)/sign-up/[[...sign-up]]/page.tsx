/**
 * Саҳифаи бақайдгирӣ (Sign Up Page).
 * Ин файл барои сохтани аккаунти нави корбар бо ёрии Clerk хизмат мекунад.
 */
"use client";

import { SignUp } from "@clerk/nextjs"; // Барои сабти номи корбар
import { useLanguage } from "@/lib/language-context"; // Барои иваз кардани забони сайт
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Card } from "@/components/ui/card"; // Барои сохтани блоки дастурамал
import { Info } from "lucide-react"; // Иконкаи маълумот

export default function Page() {
  const { t, locale, setLocale } = useLanguage();

  // Рӯйхати забонҳо барои тугмаҳо
  const languages = [
    { code: "tg", label: "Тоҷикӣ" },
    { code: "ru", label: "Русский" },
    { code: "en", label: "English" },
  ];

  return (
    // Контейнер барои дар марказ (center) нишон додани форма ва дастурамал
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      
      {/* Қисмати ивази забон пеш аз бақайдгирӣ */}
      <div className="flex gap-2 mb-6">
        {languages.map((lang) => (
          <Button
            key={lang.code}
            variant={locale === lang.code ? "default" : "outline"}
            size="sm"
            onClick={() => setLocale(lang.code as any)}
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

      {/* Блоки дастурамал барои фаҳмондани раванди регистрация */}
      <Card className="max-w-[400px] w-full p-4 mb-8 border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/10 dark:border-emerald-900/30 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex gap-3 items-start">
          <div className="mt-0.5 shrink-0 p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
            <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-[11px] sm:text-xs font-bold text-emerald-900 dark:text-emerald-300 leading-relaxed uppercase tracking-tight">
            {t('signupInstructions')}
          </p>
        </div>
      </Card>

      {/* Виҷети тайёри Clerk барои регистрация */}
      <div className="w-full max-w-[400px] flex justify-center">
        <SignUp />
      </div>
    </div>
  );
}
