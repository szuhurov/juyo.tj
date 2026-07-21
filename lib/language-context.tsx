/**
 * Идоракунии забонҳои сайт (Тоҷикӣ, Русӣ, Англисӣ).
 * Барои иваз кардани забон ва дар хотира нигоҳ доштани он.
 */
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react"; // Хукҳо ва типҳои React
import { translations, type TranslationValue } from "./translations"; // Файли тарҷумаҳо

// Намудҳои забонҳои дастгиришаванда
export type Locale = "tg" | "ru" | "en";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// Сохтани Контекст барои дастрасии глобалӣ ба забон дар тамоми барнома
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ 
  children, 
  initialLocale = "tg" 
}: { 
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  // Бори аввал хондани забони интихобшуда аз хотираи браузер (localStorage) —
  // синхронизатсия АЗ система берун аз React, ягона роҳаш effect аст.
  useEffect(() => {
    const saved = localStorage.getItem("juyo-locale") as Locale;
    if (saved && ["tg", "ru", "en"].includes(saved)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocale(saved);
      // Ҳамзамон дар Cookie сабт мекунем, то сервер ҳам хабардор шавад
      document.cookie = `juyo-locale=${saved}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, []);

  // Навсозии номи саҳифа (Tab Title) дар браузер ҳангоми иваз шудани забон
  useEffect(() => {
    const seoTitle = translations[locale]?.seoTitle;
    if (typeof seoTitle === 'string') {
      document.title = seoTitle;
    }
  }, [locale]);

  /**
   * Функсия барои сабти забони нав дар localStorage ва Cookie.
   * Сабт дар Cookie зарур аст, то ки сервер (Next.js) пеш аз боршавӣ
   * забонро фаҳмад ва SEO-ро дуруст нишон диҳад.
   */
  const setAndSaveLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("juyo-locale", newLocale);
    // Мӯҳлати эътибори Cookie - 1 сол
    document.cookie = `juyo-locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
  };

  /**
   * Функсияи асосии тарҷума (Translate).
   * Калидро (key) мегирад ва матни мувофиқро аз файли тарҷумаҳо бармегардонад.
   * Агар калид ёфт нашавад, ҳамчун 'fallback' забони англисиро истифода мебарад.
   */
  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: TranslationValue = translations[locale];

    // Ҷустуҷӯи калид дар дохили объекти тарҷумаҳо
    for (const k of keys) {
      if (value && typeof value === 'object' && !Array.isArray(value) && k in value) {
        value = value[k];
      } else {
        // Агар дар забони ҷорӣ ёфт нашавад, ба забони англисӣ мегузарем
        let fallbackValue: TranslationValue = translations['en'];
        for (const fk of keys) {
          if (fallbackValue && typeof fallbackValue === 'object' && !Array.isArray(fallbackValue) && fk in fallbackValue) {
            fallbackValue = fallbackValue[fk];
          } else {
            fallbackValue = key;
            break;
          }
        }
        value = fallbackValue;
        break;
      }
    }

    // Агар калид ба зершохаи объект/массив расад (масалан "categories" ё
    // "qrItems" бе идомаи роҳ), ин леафи ниҳоии тарҷума НЕСТ — ба худи
    // калид bargardem, то ҳаргиз объект/массив ба JSX нарасад (React онро
    // рендер карда наметавонад).
    if (typeof value !== 'string') return key;

    // Иваз кардани параметрҳо дар дохили матн (масалан, %{name})
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = (value as string).replace(new RegExp(`%{${k}}`, 'g'), String(v));
      });
    }

    return value;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale: setAndSaveLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Хуки махсус (Custom Hook) барои истифодаи осони забон дар компонентҳо
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
