"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations } from "./translations";

type Locale = "tg" | "ru" | "en";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, any>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("tg");

  useEffect(() => {
    const saved = localStorage.getItem("juyo-locale") as Locale;
    if (saved && ["tg", "ru", "en"].includes(saved)) {
      setLocale(saved);
    }
  }, []);

  const setAndSaveLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("juyo-locale", newLocale);
  };

  const t = (key: string, params?: Record<string, any>) => {
    const keys = key.split('.');
    let value = translations[locale];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Try fallback to 'en' if key not found in current locale
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

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
