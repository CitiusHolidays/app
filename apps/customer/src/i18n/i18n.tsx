import { getLocales } from 'expo-localization';
import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react';

import { useStoredValue } from '@/lib/app-store';

import { createI18n, type I18n } from './create-i18n';
import { type Language, type LanguageCode, languageFor, LANGUAGES, pickDeviceLanguage } from './languages';

/** Kept through sign-out: the language belongs to the phone, not the account. */
export const LANGUAGE_KEY = 'prefs:language';

export type { I18n };

const I18nContext = createContext<I18n | null>(null);

function deviceLanguage() {
  try {
    return pickDeviceLanguage(getLocales().map((locale) => locale.languageCode));
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useStoredValue<LanguageCode | null>(LANGUAGE_KEY, null);
  const code = stored && languageFor(stored)?.status === 'complete' ? stored : deviceLanguage();
  const language = languageFor(code) ?? (LANGUAGES[0] as Language);
  const setLanguage = useCallback((next: LanguageCode) => setStored(next), [setStored]);
  const value = useMemo(() => createI18n(language, setLanguage), [language, setLanguage]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n needs I18nProvider');
  }
  return value;
}
