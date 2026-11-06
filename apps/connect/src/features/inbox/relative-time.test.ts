import { fullTime, relativeTime } from './relative-time';

const local = (month: number, day: number, hour: number, minute = 0, year = 2026) => new Date(year, month - 1, day, hour, minute);
const now = local(11, 6, 15, 0).getTime();
const iso = (date: Date) => date.toISOString();

describe('relative time', () => {
  it('says minutes and hours on the same day', () => {
    expect(relativeTime(new Date(now - 20_000).toISOString(), now)).toBe('Now');
    expect(relativeTime(iso(local(11, 6, 14, 55)), now)).toBe('5 min');
    expect(relativeTime(iso(local(11, 6, 12, 0)), now)).toBe('3 h');
    expect(relativeTime(iso(local(11, 6, 0, 30)), now)).toBe('14 h');
  });

  it('says Yesterday, then the weekday, then the date', () => {
    expect(relativeTime(iso(local(11, 5, 23, 0)), now)).toBe('Yesterday');
    expect(relativeTime(iso(local(11, 3, 9, 0)), now)).toBe('Tue');
    expect(relativeTime(iso(local(10, 20, 9, 0)), now)).toBe('20 Oct');
    expect(relativeTime(iso(local(12, 20, 9, 0, 2025)), now)).toBe('20 Dec 2025');
  });

  it('reads a future time as now and a bad value as nothing', () => {
    expect(relativeTime(iso(local(11, 6, 16, 0)), now)).toBe('Now');
    expect(relativeTime('not a date', now)).toBe('');
    expect(fullTime('not a date')).toBe('');
  });

  it('gives the full time for screen readers', () => {
    expect(fullTime(iso(local(11, 6, 8, 15)))).toBe('Fri 6 Nov, 08:15');
  });
});
