/**
 * Саҳифаи воридшавӣ (Sign In Page).
 * Дар ин ҷо корбарон ба профили худ ворид мешаванд (логин мекунанд).
 * Ҳамааш дар асоси Clerk кор мекунад.
 */
"use client";

import { SignIn } from "@clerk/nextjs"; // Барои ворид шудан ба профил
import { useLanguage } from "@/lib/language-context"; // Барои иваз кардани забони сайт
import { Button } from "@/components/ui/button"; // Компоненти тугма
import { Card } from "@/components/ui/card"; // Барои сохтани блоки дастурамал
import { Info } from "lucide-react"; // Иконкаи маълумот
import Link from "next/link"; // Барои гузаштан ба саҳифаи дигар

export default function Page() {
  const { t, locale, setLocale } = useLanguage();

  // Рӯйхати забонҳо барои тугмаҳо
  const languages = [
    { code: "tg", label: "TG" },
    { code: "ru", label: "RU" },
    { code: "en", label: "EN" },
  ];

  // Функсия барои сохтани матн бо линки кликшаванда
  const renderInstructions = () => {
    const text = t('loginInstructions');
    const signupText = t('signup'); // Матни "Бақайдгирӣ" ё муодили он
    
    // Иваз кардани %{link} бо ҷузъи кликшаванда
    const parts = text.split('%{link}');
    
    if (parts.length < 2) return text;

    return (
      <>
        {parts[0]}
        <Link 
          href="/sign-up" 
          className="text-emerald-600 dark:text-emerald-400 underline font-black hover:text-emerald-700 transition-colors mx-1"
        >
          {signupText}
        </Link>
        {parts[1]}
      </>
    );
  };

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

      {/* Блоки дастурамал барои фаҳмондани раванди логин ва линк ба регистрация */}
      <Card className="max-w-[400px] w-full p-4 mb-8 border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/10 dark:border-emerald-900/30 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex gap-3 items-start">
          <div className="mt-0.5 shrink-0 p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
            <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-[11px] sm:text-xs font-bold text-emerald-900 dark:text-emerald-300 leading-relaxed uppercase tracking-tight">
            {renderInstructions()}
          </p>
        </div>
      </Card>

      {/* Виҷети тайёри Clerk барои логин */}
      <div className="w-full max-w-[400px] flex justify-center">
        <SignIn />
      </div>
    </div>
  );
}
