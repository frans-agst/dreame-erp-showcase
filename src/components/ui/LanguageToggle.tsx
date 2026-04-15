'use client';

import { useI18n, Language } from '@/lib/i18n';

interface LanguageToggleProps {
  className?: string;
  variant?: 'button' | 'dropdown';
}

export function LanguageToggle({ className = '', variant = 'button' }: LanguageToggleProps) {
  const { lang, setLang } = useI18n();

  const toggleLanguage = () => {
    setLang(lang === 'en' ? 'id' : 'en');
  };

  if (variant === 'dropdown') {
    return (
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Language)}
        className={`
          px-3 py-1.5 rounded-lg text-sm font-medium
          bg-surface border border-border
          text-primary cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-primary/20
          ${className}
        `}
      >
        <option value="id">🇮🇩 ID</option>
        <option value="en">🇬🇧 EN</option>
      </select>
    );
  }

  return (
    <button
      onClick={toggleLanguage}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
        text-sm font-medium transition-colors
        bg-neutral-100 dark:bg-neutral-800
        hover:bg-neutral-200 dark:hover:bg-neutral-700
        text-primary
        ${className}
      `}
      title={lang === 'en' ? 'Switch to Bahasa Indonesia' : 'Switch to English'}
    >
      <span className="text-base">{lang === 'en' ? '🇬🇧' : '🇮🇩'}</span>
      <span className="uppercase">{lang}</span>
    </button>
  );
}
