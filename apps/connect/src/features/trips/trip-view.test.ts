import { resolveTripView } from './trip-view';

describe('trip view param', () => {
  it('opens the view Today asks for', () => {
    expect(resolveTripView('contacts')).toBe('contacts');
    expect(resolveTripView('schedule')).toBe('schedule');
    expect(resolveTripView(['schedule', 'roster'])).toBe('schedule');
  });

  it('falls back to the roster for a missing or unknown view', () => {
    expect(resolveTripView(undefined)).toBe('roster');
    expect(resolveTripView('payments')).toBe('roster');
    expect(resolveTripView([])).toBe('roster');
  });
});
