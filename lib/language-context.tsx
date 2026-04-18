/**
 * Идоракунии забонҳои сайт (Тоҷикӣ, Русӣ, Англисӣ).
 * Барои иваз кардани забон ва дар хотира нигоҳ доштани он.
 */
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react"; // Хукҳо ва типҳои React
import { translations } from "./translations"; // Файли тарҷумаҳо

// Намудҳои забонҳои дастгиришаванда
type Locale = "tg" | "ru" | "en";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, any>) => string;
}

// Сохтани Контекст барои дастрасии глобалӣ ба забон дар тамоми барнома
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("tg");

  // Бори аввал хондани забони интихобшуда аз хотираи браузер (localStorage)
  useEffect(() => {
    const saved = localStorage.getItem("juyo-locale") as Locale;
    if (saved && ["tg", "ru", "en"].includes(saved)) {
      setLocale(saved);
    }
  }, []);

  // Навсозии номи саҳифа (Tab Title) дар браузер ҳангоми иваз шудани забон
  useEffect(() => {
    const t = translations[locale];
    if (t && t.seoTitle) {
      document.title = t.seoTitle;
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
  const t = (key: string, params?: Record<string, any>) => {
    const keys = key.split('.');
    let value = translations[locale];
    
    // Ҷустуҷӯи калид дар дохили объекти тарҷумаҳо
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Агар дар забони ҷорӣ ёфт нашавад, ба забони англисӣ мегузарем
        let fallbackValue = translations['en'];
        for (const fk of keys) {
          if (fallbackValue && typeof fallbackValue === 'object' && fk in fallbackValue) {
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

    if (typeof value !== 'string') return key;

    // Иваз кардани параметрҳо дар дохили матн (масалан, %{name})
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = (value as string).replace(new RegExp(`%{${k}}`, 'g'), String(v));
      });
    }

    return value as string;
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
