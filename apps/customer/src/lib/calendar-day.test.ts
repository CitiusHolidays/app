import { parseCalendarDay } from './calendar-day';

describe('calendar days', () => {
  it('reads a YYYY-MM-DD day, ignoring surrounding space', () => {
    expect(parseCalendarDay('2026-11-09')).toEqual({ day: 9, month: 10, year: 2026 });
    expect(parseCalendarDay(' 2026-01-31 ')).toEqual({ day: 31, month: 0, year: 2026 });
  });

  it('refuses anything else', () => {
    for (const value of [null, undefined, '', 'soon', '2026-11-9', '09/11/2026', '2026-11-09T10:00']) {
      expect(parseCalendarDay(value)).toBeNull();
    }
  });
});
