import { getLocales } from 'expo-localization';
import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react';

import { useStoredValue } from '@/lib/app-store';

import { type PluralBase, translate, translateOptional, translatePlural, type Vars } from './catalog';
import { formatDate, formatDay, formatDayRange, formatMoment, formatTime, formatWeekday } from './format';
import { type Language, type LanguageCode, languageFor, LANGUAGES, pickDeviceLanguage } from './languages';
import type { MessageKey } from './locales/en';

/** Kept through sign-out: the language belongs to the phone, not the account. */
export const LANGUAGE_KEY = 'prefs:language';

export interface I18n {
  language: Language;
  setLanguage: (code: LanguageCode) => Promise<void>;
  t: (key: MessageKey, vars?: Vars) => string;
  tn: (base: PluralBase, count: number, vars?: Vars) => string;
  /** A server word (status) by key, or the word itself when there is no translation. */
  tWord: (key: string, fallback: string) => string;
  day: (value: string, withYear?: boolean) => string;
  /** An instant as "14 Nov" (or "14 Nov 2026"). */
  date: (value: number, withYear?: boolean) => string;
  dayRange: (start: string | null, end: string | null) => string | null;
  moment: (value: number, now: number) => string;
  time: (value: number) => string;
  weekday: (value: number) => string;
}

export function createI18n(language: Language, setLanguage: I18n['setLanguage'] = async () => undefined): I18n {
  return {
    date: (value, withYear) => formatDate(language.intl, value, withYear),
    day: (value, withYear) => formatDay(language.intl, value, withYear),
    dayRange: (start, end) => formatDayRange(language.intl, start, end),
    language,
    moment: (value, now) => formatMoment(language.intl, value, now),
    setLanguage,
    t: (key, vars) => translate(language.code, key, vars),
    time: (value) => formatTime(language.intl, value),
    tn: (base, count, vars) => translatePlural(language.code, base, count, vars),
    tWord: (key, fallback) => translateOptional(language.code, key, fallback),
    weekday: (value) => formatWeekday(language.intl, value),
  };
}

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
