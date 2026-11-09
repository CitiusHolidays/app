import { APP_LOCALE, CLOCK_OPTIONS, dateKicker, formatDateRange, WEEKDAY_DATE } from './dates';

describe('dates', () => {
  it('writes the date line over a screen title: weekday, day and month', () => {
    expect(dateKicker(new Date(2026, 10, 7, 9, 41).getTime())).toBe('Sat 7 Nov');
    expect(WEEKDAY_DATE.format(new Date(2026, 10, 6))).toBe('Fri 6 Nov');
  });

  it('writes a trip range once per distinct day, and says when dates are missing', () => {
    const start = formatDateRange('2026-11-04', '2026-11-04');
    const end = formatDateRange('2026-11-11', '2026-11-11');
    expect(start).toMatch(/4/);
    expect(formatDateRange('2026-11-04', '2026-11-11')).toBe(`${start} – ${end}`);
    expect(formatDateRange('2026-11-04', '')).toBe(start);
    expect(formatDateRange('', '2026-11-11')).toBe('Dates not set');
    expect(formatDateRange('4 Nov', '2026-11-11')).toBe('Dates not set');
  });

  it('writes every date the same way whatever the phone language, on a 24-hour clock', () => {
    // The trip range used the phone's locale ("Nov 4") while the kicker said "Fri 6 Nov".
    expect(formatDateRange('2026-11-04', '2026-11-11')).toBe('4 Nov – 11 Nov');
    const evening = new Date(2026, 10, 6, 20, 5);
    expect(new Intl.DateTimeFormat(APP_LOCALE, CLOCK_OPTIONS).format(evening)).toBe('20:05');
  });
});
