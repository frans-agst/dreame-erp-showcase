'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { translations, Language } from './translations';

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

const STORAGE_KEY = 'omnierp-erp-lang';
const DEFAULT_LANG: Language = 'en'; // Default to English

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [lang, setLangState] = useState<Language>(DEFAULT_LANG);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load saved language preference on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved && (saved === 'en' || saved === 'id')) {
      setLangState(saved);
    }
    setIsHydrated(true);
  }, []);

  // Save language preference
  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
  }, []);

  // Translation function with nested key support
  const t = useCallback((key: string): string => {
    const keys = key.split('.');
    let value: unknown = translations[lang];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        // Key not found, return the key itself
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    // If value is not a string, return the key
    return key;
  }, [lang]);

  // Prevent hydration mismatch by rendering default until hydrated
  if (!isHydrated) {
    return (
      <I18nContext.Provider value={{ lang: DEFAULT_LANG, setLang, t }}>
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// Hook for getting current language
export function useLanguage(): Language {
  const { lang } = useI18n();
  return lang;
}

// Hook for translation function only
export function useTranslation() {
  const { t } = useI18n();
  return t;
}
