import { type PluralBase, translate, translateOptional, translatePlural, type Vars } from './catalog';
import { formatDate, formatDay, formatDayRange, formatMoment, formatTime, formatWeekday } from './format';
import type { Language, LanguageCode } from './languages';
import type { MessageKey } from './locales/en';

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
