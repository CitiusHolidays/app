// Formatters are built once: an Intl formatter is slow to construct.

/**
 * Every date and time in the app reads the same way, whatever the phone's language: British
 * English order ("Fri 6 Nov") and a 24-hour clock ("08:15"). Build formatters from these two.
 */
export const APP_LOCALE = 'en-GB';
export const CLOCK_OPTIONS = { hour: '2-digit', hourCycle: 'h23', minute: '2-digit' } as const satisfies Intl.DateTimeFormatOptions;

/** "4 Nov". */
export const DAY_MONTH = new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'short' });

/** "Fri 6 Nov": the date line over a screen title, and a day on the trip schedule. */
export const WEEKDAY_DATE = new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'short', weekday: 'short' });

/** Local midnight at the start of a `YYYY-MM-DD` date, or null when the text is not that shape. */
export function parseDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Local midnight at the start of the day `time` falls on, in milliseconds. */
export function midnightOf(time: number) {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** A trip's dates from its `YYYY-MM-DD` start and end: "4 Nov – 11 Nov", one day once. */
export function formatDateRange(start: string, end: string) {
  const format = (value: string) => {
    const day = parseDay(value);
    return day ? DAY_MONTH.format(day) : '';
  };
  const from = format(start);
  const to = format(end);
  if (!from) return 'Dates not set';
  return to && to !== from ? `${from} – ${to}` : from;
}

/** "FRI 6 NOV": the date line over a screen title. */
export function dateKicker(now: number) {
  return WEEKDAY_DATE.format(new Date(now));
}
