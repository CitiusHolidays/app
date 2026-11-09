export interface CalendarDay {
  day: number;
  /** 0-based, as `Date` takes it. */
  month: number;
  year: number;
}

/**
 * A trip date as the server sends it: a calendar day (YYYY-MM-DD) with no time zone. Callers turn
 * it into the instant they need (local midnight for "today", UTC for formatting and night counts).
 */
export function parseCalendarDay(value: string | null | undefined): CalendarDay | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim()) : null;
  return match ? { day: Number(match[3]), month: Number(match[2]) - 1, year: Number(match[1]) } : null;
}
