/**
 * Site language management (Tajik, Russian, English).
 * For switching the language and remembering it.
 */
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react"; // React hooks and types
import { translations, type TranslationValue } from "./translations"; // Translations file

// Supported language types
export type Locale = "tg" | "ru" | "en";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// Creating the Context for global access to the language throughout the app
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ 
  children, 
  initialLocale = "tg" 
}: { 
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  // First read of the selected language from browser storage (localStorage) —
  // syncing FROM a system outside React, the only way is an effect.
  useEffect(() => {
    const saved = localStorage.getItem("juyo-locale") as Locale;
    if (saved && ["tg", "ru", "en"].includes(saved)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocale(saved);
      // Also record it in a Cookie, so the server knows about it too
      document.cookie = `juyo-locale=${saved}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, []);

  // Updating the page title (Tab Title) in the browser when the language changes
  useEffect(() => {
    const seoTitle = translations[locale]?.seoTitle;
    if (typeof seoTitle === 'string') {
      document.title = seoTitle;
    }
  }, [locale]);

  /**
   * Function for recording the new language in localStorage and the Cookie.
   * Recording it in the Cookie is necessary so the server (Next.js)
   * knows the language before rendering and shows SEO correctly.
   */
  const setAndSaveLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("juyo-locale", newLocale);
    // Cookie expiration - 1 year
    document.cookie = `juyo-locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
  };

  /**
   * The main translation function (Translate).
   * Takes a key and returns the matching text from the translations file.
   * If the key isn't found, it falls back to the English language.
   */
  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: TranslationValue = translations[locale];

    // Searching for the key inside the translations object
    for (const k of keys) {
      if (value && typeof value === 'object' && !Array.isArray(value) && k in value) {
        value = value[k];
      } else {
        // If not found in the current language, fall back to English
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

    // If the key resolves to an object/array sub-branch (e.g. "categories" or
    // "qrItems" without a further path), this is NOT a final translation leaf —
    // return the key itself, so that an object/array never reaches JSX
    // (React cannot render it).
    if (typeof value !== 'string') return key;

    // Replacing parameters inside the text (e.g. %{name})
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

// Custom Hook for easy use of the language in components
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
