const MINUTE = 60_000;
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
  if (days < 7) return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: new Date(value).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
  }).format(value);
}

/** The full time for screen readers and the detail screen: "Fri 6 Nov, 08:15". */
export function fullTime(iso: string) {
  const value = Date.parse(iso);
  if (Number.isNaN(value)) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short', weekday: 'short' }).format(value);
}
