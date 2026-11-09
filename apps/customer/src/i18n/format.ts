/**
 * Dates as the traveller reads them. Trip dates are calendar days (YYYY-MM-DD) with no time zone:
 * they are formatted as that day, never shifted by the phone's zone.
 */

import { parseCalendarDay } from '@/lib/calendar-day';

/** Noon UTC on the day, so formatting in UTC can never land on a neighbouring day. */
function calendarDay(value: string) {
  const day = parseCalendarDay(value);
  return day ? new Date(Date.UTC(day.year, day.month, day.day, 12)) : null;
}

const dayFormat = (intl: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(intl, { ...options, timeZone: 'UTC' });

/** "14 Nov 2026", or the raw value if it is not a calendar day. */
export function formatDay(intl: string, value: string, withYear = true) {
  const date = calendarDay(value);
  if (!date) return value;
  return dayFormat(intl, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(date);
}

/** "14 – 20 Nov 2026" style ranges, by the locale's own rules. */
export function formatDayRange(intl: string, start: string | null, end: string | null) {
  const from = start ? calendarDay(start) : null;
  const to = end ? calendarDay(end) : null;
  if (from && to && to.getTime() !== from.getTime()) {
    const format = dayFormat(intl, { day: 'numeric', month: 'short', year: 'numeric' });
    return typeof format.formatRange === 'function' ? format.formatRange(from, to) : `${format.format(from)} – ${format.format(to)}`;
  }
  if (from) return formatDay(intl, start ?? '');
  return null;
}

/** "Sat 14 Nov": the label beside a day in the plan. */
export function formatWeekday(intl: string, value: number) {
  return new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short', weekday: 'short' }).format(new Date(value));
}

/** "14 Nov" for an instant in the phone's zone, with the year when asked. */
export function formatDate(intl: string, value: number, withYear = false) {
  return new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(
    new Date(value)
  );
}

/** "07:12" in the phone's zone, for freshness stamps. */
export function formatTime(intl: string, value: number) {
  return new Intl.DateTimeFormat(intl, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

/** "Today 07:12" or "12 Nov, 07:12" for announcements. */
export function formatMoment(intl: string, value: number, now: number) {
  const date = new Date(value);
  const sameDay = new Date(now).toDateString() === date.toDateString();
  if (sameDay) return formatTime(intl, value);
  return new Intl.DateTimeFormat(intl, { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' }).format(date);
}

const longDates = new Map<string, Intl.DateTimeFormat>();

/** "Friday, 6 November": the Journeys heading's kicker. One formatter per language. */
export function formatLongDate(intl: string, value: number) {
  let format = longDates.get(intl);
  if (!format) {
    format = new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'long', weekday: 'long' });
    longDates.set(intl, format);
  }
  return format.format(new Date(value));
}
