'use client';

import { languages, useLanguage } from '@/providers/LanguageProvider';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { selectedLanguage, setSelectedLanguage, t } = useLanguage();

  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">{t('language')}</span>
      <select
        value={selectedLanguage}
        onChange={(event) => setSelectedLanguage(event.target.value as typeof selectedLanguage)}
        aria-label={t('language')}
        className="appearance-none rounded-full border border-zinc-200 bg-white/80 py-2 pe-8 ps-3 text-sm text-zinc-600 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-all duration-200 cursor-pointer"
      >
        {languages.map((language) => (
          <option key={language} value={language} className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
            {language}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="pointer-events-none absolute end-2.5 h-4 w-4 text-zinc-500 dark:text-zinc-400"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}
