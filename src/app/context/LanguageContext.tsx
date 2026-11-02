import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Language, LanguageCode } from './language-types';
import { translations } from './translations';

export type { Language, LanguageCode };

export const languages: Language[] = [
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'no', label: 'Norsk' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'ko', label: '한국어' },
];

interface LanguageContextProps {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'markdown-them-language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) as LanguageCode;
      if (saved && translations[saved]) {
        return saved;
      }
      // Detect browser language
      const navLang = window.navigator.language.split('-')[0] as LanguageCode;
      if (navLang && translations[navLang]) {
        return navLang;
      }
    }
    return 'en';
  });

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.setAttribute('data-lang', language);
    }
  }, [language]);

  const t = (key: string): string => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
