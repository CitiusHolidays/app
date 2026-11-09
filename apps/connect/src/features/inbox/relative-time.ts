import { APP_LOCALE, CLOCK_OPTIONS } from '@/lib/dates';

const MINUTE = 60_000;
// Built once: an Intl formatter is slow to construct.
const WEEKDAY = new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'short' });
const DAY_MONTH = new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'short' });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const FULL_TIME = new Intl.DateTimeFormat(APP_LOCALE, { ...CLOCK_OPTIONS, day: 'numeric', month: 'short', weekday: 'short' });
const HOUR = 60 * MINUTE;

function dayStart(time: number) {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * When a notification arrived, said briefly: "Now", "5 min", "3 h", "Yesterday", "Tue", then
 * "4 Nov". Times in the future (a clock that is off) read as "Now".
 */
export function relativeTime(iso: string, now: number) {
  const value = Date.parse(iso);
  if (Number.isNaN(value)) return '';
  const elapsed = now - value;
  if (elapsed < MINUTE) return 'Now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min`;
  const days = Math.round((dayStart(now) - dayStart(value)) / (24 * HOUR));
  if (days === 0) return `${Math.floor(elapsed / HOUR)} h`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return WEEKDAY.format(value);
  return (new Date(value).getFullYear() === new Date(now).getFullYear() ? DAY_MONTH : DAY_MONTH_YEAR).format(value);
}

/** The full time for screen readers and the detail screen: "Fri 6 Nov, 08:15". */
export function fullTime(iso: string) {
  const value = Date.parse(iso);
  if (Number.isNaN(value)) return '';
  return FULL_TIME.format(value);
}
