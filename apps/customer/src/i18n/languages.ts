/**
 * Every language the app is built for (owner decision, 7 Nov 2026: all the major Indian
 * languages). A language is offered in the picker once its message file is complete; until then
 * it is listed as coming soon. To add one, fill `locales/<code>.ts` (every key of `en.ts`; the
 * completeness test lists what is missing) and set `status: 'complete'` here.
 *
 * Urdu is right-to-left: before it is switched on, the app needs an RTL layout pass
 * (`I18nManager.forceRTL` needs a restart, and rows with leading marks must mirror).
 */
export type LanguageCode = 'en' | 'hi' | 'bn' | 'mr' | 'te' | 'ta' | 'gu' | 'kn' | 'ml' | 'pa' | 'or' | 'as' | 'ur';

export interface Language {
  code: LanguageCode;
  /** BCP 47 tag for dates and plural rules. */
  intl: string;
  /** The language's name in English, for screen readers and support. */
  englishName: string;
  /** The language's name in its own script, shown in the picker. */
  nativeName: string;
  rtl: boolean;
  script: 'latin' | 'indic';
  status: 'complete' | 'planned';
}

export const LANGUAGES: readonly Language[] = [
  { code: 'en', englishName: 'English', intl: 'en-IN', nativeName: 'English', rtl: false, script: 'latin', status: 'complete' },
  { code: 'hi', englishName: 'Hindi', intl: 'hi-IN', nativeName: 'हिन्दी', rtl: false, script: 'indic', status: 'complete' },
  { code: 'bn', englishName: 'Bengali', intl: 'bn-IN', nativeName: 'বাংলা', rtl: false, script: 'indic', status: 'planned' },
  { code: 'mr', englishName: 'Marathi', intl: 'mr-IN', nativeName: 'मराठी', rtl: false, script: 'indic', status: 'planned' },
  { code: 'te', englishName: 'Telugu', intl: 'te-IN', nativeName: 'తెలుగు', rtl: false, script: 'indic', status: 'planned' },
  { code: 'ta', englishName: 'Tamil', intl: 'ta-IN', nativeName: 'தமிழ்', rtl: false, script: 'indic', status: 'planned' },
  { code: 'gu', englishName: 'Gujarati', intl: 'gu-IN', nativeName: 'ગુજરાતી', rtl: false, script: 'indic', status: 'planned' },
  { code: 'kn', englishName: 'Kannada', intl: 'kn-IN', nativeName: 'ಕನ್ನಡ', rtl: false, script: 'indic', status: 'planned' },
  { code: 'ml', englishName: 'Malayalam', intl: 'ml-IN', nativeName: 'മലയാളം', rtl: false, script: 'indic', status: 'planned' },
  { code: 'pa', englishName: 'Punjabi', intl: 'pa-IN', nativeName: 'ਪੰਜਾਬੀ', rtl: false, script: 'indic', status: 'planned' },
  { code: 'or', englishName: 'Odia', intl: 'or-IN', nativeName: 'ଓଡ଼ିଆ', rtl: false, script: 'indic', status: 'planned' },
  { code: 'as', englishName: 'Assamese', intl: 'as-IN', nativeName: 'অসমীয়া', rtl: false, script: 'indic', status: 'planned' },
  { code: 'ur', englishName: 'Urdu', intl: 'ur-IN', nativeName: 'اردو', rtl: true, script: 'indic', status: 'planned' },
];

export function languageFor(code: string | null | undefined): Language | undefined {
  return LANGUAGES.find((language) => language.code === code);
}

/** The first complete language among the device's preferred languages, else English. */
export function pickDeviceLanguage(deviceCodes: readonly (string | null | undefined)[]): LanguageCode {
  for (const code of deviceCodes) {
    const language = languageFor(code?.toLowerCase().split('-')[0]);
    if (language?.status === 'complete') return language.code;
  }
  return 'en';
}
