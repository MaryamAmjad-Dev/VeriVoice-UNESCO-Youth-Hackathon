'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { languageCodes, translations, type Language, type TranslationKey } from '@/data/translations';
export const languages = Object.keys(languageCodes) as Language[];
type Value = { selectedLanguage: Language; setSelectedLanguage: (language: Language) => void; t: (key: TranslationKey) => string };
const LanguageContext = createContext<Value | undefined>(undefined);
const storageKey = 'verivoice-selected-language';
export function LanguageProvider({ children }: { children: React.ReactNode }) {
 const [selectedLanguage, setLanguage] = useState<Language>('English');
 useEffect(() => { const saved = localStorage.getItem(storageKey) as Language | null; if (saved && languages.includes(saved)) { const id = window.setTimeout(() => setLanguage(saved), 0); return () => window.clearTimeout(id); } }, []);
 useEffect(() => { const code = languageCodes[selectedLanguage]; document.documentElement.lang = code; document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr'; }, [selectedLanguage]);
 const setSelectedLanguage = (language: Language) => { setLanguage(language); localStorage.setItem(storageKey, language); };
 const t = (key: TranslationKey) => translations[selectedLanguage][key] || translations.English[key];
 return <LanguageContext.Provider value={{ selectedLanguage, setSelectedLanguage, t }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { const value = useContext(LanguageContext); if (!value) throw new Error('useLanguage must be used within a LanguageProvider'); return value; }