import type { LanguageCode } from './languages';
import { as } from './locales/as';
import { bn } from './locales/bn';
import { en, type MessageKey, type Messages } from './locales/en';
import { gu } from './locales/gu';
import { hi } from './locales/hi';
import { kn } from './locales/kn';
import { ml } from './locales/ml';
import { mr } from './locales/mr';
import { or } from './locales/or';
import { pa } from './locales/pa';
import { ta } from './locales/ta';
import { te } from './locales/te';
import { ur } from './locales/ur';

export const CATALOG: Record<LanguageCode, Partial<Messages>> = { as, bn, en, gu, hi, kn, ml, mr, or, pa, ta, te, ur };

export type Vars = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

/** The placeholders a message uses, for the translation checks. */
export function placeholders(message: string) {
  return [...message.matchAll(PLACEHOLDER)].map((match) => match[1]).sort();
}

function fill(message: string, vars?: Vars) {
  if (!vars) return message;
  return message.replace(PLACEHOLDER, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** One message in `language`, falling back to English for a key not translated yet. */
export function translate(language: LanguageCode, key: MessageKey, vars?: Vars) {
  return fill(CATALOG[language][key] ?? en[key], vars);
}

/** Keys that are plural families: `base_one`, `base_other`, ... */
export type PluralBase = {
  [K in MessageKey]: K extends `${infer Base}_other` ? Base : never;
}[MessageKey];

/**
 * CLDR cardinal plural categories for the app's languages, for whole numbers. Hermes has no
 * `Intl.PluralRules`, so the rules are written out: these languages use only `one` and `other`;
 * in Hindi, Bengali, Gujarati, Kannada, Assamese and Punjabi zero also takes `one`.
 */
const ZERO_IS_ONE: ReadonlySet<LanguageCode> = new Set(['as', 'bn', 'gu', 'hi', 'kn', 'pa']);

export function pluralCategory(language: LanguageCode, count: number): 'one' | 'other' {
  if (count === 1) return 'one';
  return count === 0 && ZERO_IS_ONE.has(language) ? 'one' : 'other';
}

/** A plural message: picks `_one` or `_other` by the language's rules. */
export function translatePlural(language: LanguageCode, base: PluralBase, count: number, vars?: Vars) {
  const rule = pluralCategory(language, count);
  const key = `${base}_${rule}` as MessageKey;
  const table = CATALOG[language];
  const message = table[key] ?? table[`${base}_other` as MessageKey] ?? en[key] ?? en[`${base}_other` as MessageKey];
  return fill(message, { count, ...vars });
}

/** A dynamic key, such as a status word from the server; unknown ones come back as `fallback`. */
export function translateOptional(language: LanguageCode, key: string, fallback: string) {
  const table = CATALOG[language] as Record<string, string | undefined>;
  return table[key] ?? (en as Record<string, string | undefined>)[key] ?? fallback;
}
