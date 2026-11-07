import type { TripSummary } from '@citius/backend/customer';

import { documentProgress, featuredTrip, parseInviteToken, splitTrips, statusKind, tripTiming } from './model';

const at = (year: number, month: number, day: number, hour = 10) => new Date(year, month - 1, day, hour).getTime();

function trip(overrides: Partial<TripSummary>): TripSummary {
  return {
    cover: null,
    destination: 'Bali',
    groupName: 'Synthetic group',
    jobCode: 'JC-1',
    minorCount: 0,
    phase: 'upcoming',
    role: 'traveller',
    travelEndDate: '2026-11-20',
    travelStartDate: '2026-11-15',
    travellerName: 'Asha Testguest',
    tripId: 't1',
    ...overrides,
  };
}

describe('trip timing', () => {
  it('counts calendar days to the start', () => {
    expect(tripTiming(trip({}), at(2026, 11, 3, 23))).toEqual({ days: 12, kind: 'countdown' });
    expect(tripTiming(trip({}), at(2026, 11, 14, 1))).toEqual({ days: 1, kind: 'countdown' });
  });

  it('says which day of the trip it is', () => {
    expect(tripTiming(trip({ phase: 'ongoing' }), at(2026, 11, 15))).toEqual({ day: 1, kind: 'progress', total: 6 });
    expect(tripTiming(trip({ phase: 'ongoing' }), at(2026, 11, 20, 23))).toEqual({ day: 6, kind: 'progress', total: 6 });
  });

  it('is over for past trips and unknown without dates', () => {
    expect(tripTiming(trip({ phase: 'past' }), at(2026, 12, 1))).toEqual({ kind: 'done' });
    expect(tripTiming(trip({ travelEndDate: null, travelStartDate: null }), at(2026, 11, 1))).toEqual({ kind: 'unknown' });
  });
});

describe('trip lists', () => {
  const trips = [
    trip({ travelStartDate: '2026-12-10', tripId: 'later' }),
    trip({ phase: 'past', travelStartDate: '2026-01-01', tripId: 'old' }),
    trip({ phase: 'past', travelStartDate: '2026-06-01', tripId: 'recent' }),
    trip({ travelStartDate: '2026-11-15', tripId: 'soon' }),
  ];

  it('orders active trips soonest first and past trips newest first', () => {
    const { active, past } = splitTrips(trips);
    expect(active.map((row) => row.tripId)).toEqual(['soon', 'later']);
    expect(past.map((row) => row.tripId)).toEqual(['recent', 'old']);
  });

  it('leads with a trip under way, else the next one', () => {
    expect(featuredTrip(trips)?.tripId).toBe('soon');
    expect(featuredTrip([...trips, trip({ phase: 'ongoing', tripId: 'now' })])?.tripId).toBe('now');
    expect(featuredTrip([trip({ phase: 'past' })])).toBeNull();
  });
});

describe('document status', () => {
  it('marks done, waiting and refused states', () => {
    expect(statusKind('Approved')).toBe('good');
    expect(statusKind('Documents Pending')).toBe('attention');
    expect(statusKind('Rejected')).toBe('danger');
    expect(statusKind(null)).toBe('neutral');
  });

  it('counts a visa that is not required as done', () => {
    expect(
      documentProgress([
        {
          fullName: 'A',
          isMinor: false,
          passportStatus: 'Received',
          ticketStatus: 'Pending Issue',
          travellerId: 'a',
          visaRequired: false,
          visaStatus: null,
        },
      ])
    ).toEqual({ done: 2, total: 3 });
  });
});

describe('invite links', () => {
  const token = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123-_6';
  it('reads the token from the website link, the app link or on its own', () => {
    expect(parseInviteToken(`https://www.citiusholidays.com/app/invite#token=${token}`)).toBe(token);
    expect(parseInviteToken(`citius://invite?token=${token}`)).toBe(token);
    expect(parseInviteToken(`  ${token} `)).toBe(token);
  });

  it('rejects anything else', () => {
    expect(parseInviteToken('https://example.com')).toBeNull();
    expect(parseInviteToken(`https://x.test/app/invite#token=${token}extra`)).toBeNull();
  });
});
