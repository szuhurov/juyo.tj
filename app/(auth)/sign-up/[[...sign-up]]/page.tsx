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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white dark:bg-zinc-950 py-12 relative">
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

      <div className="w-full max-w-[420px] mt-12">
        <div className="animate-in fade-in zoom-in-95 duration-700 flex flex-col items-center">
          <div className="w-full flex justify-center">
            <SignUp
              signInUrl="/sign-in"
              appearance={{
                theme: "simple",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
