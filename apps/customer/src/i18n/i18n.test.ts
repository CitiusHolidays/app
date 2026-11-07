import { CATALOG, placeholders, pluralCategory, translate, translatePlural } from './catalog';
import { formatDay, formatDayRange } from './format';
import { LANGUAGES, pickDeviceLanguage } from './languages';
import { en, type MessageKey } from './locales/en';

const keys = Object.keys(en) as MessageKey[];

describe('translations', () => {
  it.each(LANGUAGES.filter((language) => language.status === 'complete').map((language) => language.code))(
    '%s has every message',
    (code) => {
      const missing = keys.filter((key) => !CATALOG[code][key]?.trim());
      expect(missing).toEqual([]);
    }
  );

  it.each(LANGUAGES.map((language) => language.code))('%s keeps every placeholder of each message it translates', (code) => {
    const table = CATALOG[code];
    for (const key of keys) {
      const message = table[key];
      if (message !== undefined) {
        expect({ key, placeholders: placeholders(message) }).toEqual({ key, placeholders: placeholders(en[key]) });
      }
    }
  });

  it('has a message file for every language and no stray keys', () => {
    for (const language of LANGUAGES) {
      const extra = Object.keys(CATALOG[language.code]).filter((key) => !(key in en));
      expect({ code: language.code, extra }).toEqual({ code: language.code, extra: [] });
    }
  });

  it('falls back to English for a language that is not translated yet', () => {
    expect(translate('ta', 'tabs.journeys')).toBe('Journeys');
    expect(translate('hi', 'tabs.journeys')).toBe('यात्राएँ');
  });

  it('fills placeholders and picks plural forms by the language', () => {
    expect(translate('en', 'common.call', { name: 'Priya' })).toBe('Call Priya');
    expect(translatePlural('en', 'countdown.days', 1)).toBe('Starts in 1 day');
    expect(translatePlural('en', 'countdown.days', 12)).toBe('Starts in 12 days');
    expect(translatePlural('hi', 'journeys.withChildren', 2)).toBe('2 बच्चों के साथ');
  });

  it('follows CLDR: zero is singular in Hindi, plural in English', () => {
    expect(pluralCategory('en', 0)).toBe('other');
    expect(pluralCategory('hi', 0)).toBe('one');
    expect(pluralCategory('ta', 1)).toBe('one');
    expect(pluralCategory('ta', 2)).toBe('other');
  });
});

describe('language choice', () => {
  it('uses the first complete device language, else English', () => {
    expect(pickDeviceLanguage(['hi'])).toBe('hi');
    expect(pickDeviceLanguage(['ta', 'hi'])).toBe('hi');
    expect(pickDeviceLanguage(['fr', null])).toBe('en');
  });

  it('offers English and Hindi now and lists the other major Indian languages', () => {
    expect(LANGUAGES.filter((language) => language.status === 'complete').map((language) => language.code)).toEqual(['en', 'hi']);
    expect(LANGUAGES.map((language) => language.code)).toEqual(
      expect.arrayContaining(['bn', 'mr', 'te', 'ta', 'gu', 'kn', 'ml', 'pa', 'or', 'as', 'ur'])
    );
  });
});

describe('trip dates', () => {
  it('formats calendar days without shifting them by time zone', () => {
    expect(formatDay('en-IN', '2026-11-14')).toMatch(/14 Nov 2026/);
    expect(formatDay('en-IN', 'soon')).toBe('soon');
  });

  it('formats a range and a single day', () => {
    expect(formatDayRange('en-IN', '2026-11-14', '2026-11-20')).toMatch(/14.*20 Nov 2026/);
    expect(formatDayRange('en-IN', '2026-11-14', null)).toMatch(/14 Nov 2026/);
    expect(formatDayRange('en-IN', null, null)).toBeNull();
  });
});
