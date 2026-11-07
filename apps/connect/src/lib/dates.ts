// Formatters are built once: an Intl formatter is slow to construct.

/** "4 Nov" in the phone's own language. */
const DAY_MONTH = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

/** "Fri 6 Nov": the date line over a screen title, and a day on the trip schedule. */
export const WEEKDAY_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', weekday: 'short' });

/** A trip's dates from its `YYYY-MM-DD` start and end: "Nov 4 – Nov 11", one day once. */
export function formatDateRange(start: string, end: string) {
  const format = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return '';
    return DAY_MONTH.format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
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
