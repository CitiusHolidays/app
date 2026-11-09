import type { TripSummary } from '@citius/backend/customer';

import { documentProgress, featuredTrip, journeyRows, parseInviteToken, splitTrips, shownVisaStatus, statusKind, tripStage, tripTiming } from './model';

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

describe('trip stage', () => {
  it('moves a trip saved before it began into "under way" once its first day comes', () => {
    // Saved on the 14th (upcoming); opened offline on the 16th.
    expect(tripStage(trip({ phase: 'upcoming' }), at(2026, 11, 16))).toEqual({ phase: 'ongoing', timing: { day: 2, kind: 'progress', total: 6 } });
  });

  it('closes a trip saved while under way once its last day has passed', () => {
    expect(tripStage(trip({ phase: 'ongoing' }), at(2026, 11, 22))).toEqual({ phase: 'past', timing: { kind: 'done' } });
  });

  it('starts on day 1 when India has reached the first day before this phone has', () => {
    // A traveller west of India, the evening before: the server already says ongoing.
    expect(tripStage(trip({ phase: 'ongoing' }), at(2026, 11, 14, 21))).toEqual({ phase: 'ongoing', timing: { day: 1, kind: 'progress', total: 6 } });
  });

  it('never steps a trip back: a "past" from the server stands on the last evening here', () => {
    expect(tripStage(trip({ phase: 'past' }), at(2026, 11, 20, 21))).toEqual({ phase: 'past', timing: { kind: 'done' } });
  });

  it('keeps the phase from the server when the dates are not set', () => {
    expect(tripStage(trip({ phase: 'upcoming', travelEndDate: null, travelStartDate: null }), at(2026, 11, 1))).toEqual({ phase: 'upcoming', timing: { kind: 'unknown' } });
  });
});

/** Before every trip in these lists has started, so their saved phases still hold. */
const before = at(2026, 11, 1);

describe('trip lists', () => {
  const trips = [
    trip({ travelStartDate: '2026-12-10', tripId: 'later' }),
    trip({ phase: 'past', travelStartDate: '2026-01-01', tripId: 'old' }),
    trip({ phase: 'past', travelStartDate: '2026-06-01', tripId: 'recent' }),
    trip({ travelStartDate: '2026-11-15', tripId: 'soon' }),
  ];

  it('orders active trips soonest first and past trips newest first', () => {
    const { active, past } = splitTrips(trips, before);
    expect(active.map((row) => row.tripId)).toEqual(['soon', 'later']);
    expect(past.map((row) => row.tripId)).toEqual(['recent', 'old']);
  });

  it('leads with a trip under way, else the next one', () => {
    expect(featuredTrip(trips, before)?.tripId).toBe('soon');
    expect(featuredTrip([...trips, trip({ phase: 'ongoing', tripId: 'now' })], before)?.tripId).toBe('now');
    expect(featuredTrip([trip({ phase: 'past' })], before)).toBeNull();
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

describe('journeys list rows', () => {
  const shape = (rows: ReturnType<typeof journeyRows>) =>
    rows.map((row) => (row.kind === 'section' ? `# ${row.section}` : `${row.kind} ${row.trip.tripId}`));

  it('leads with the trip under way under "happening now", then upcoming and past', () => {
    const rows = journeyRows([
      trip({ phase: 'past', travelStartDate: '2026-01-01', tripId: 'old' }),
      trip({ travelStartDate: '2026-12-10', tripId: 'later' }),
      trip({ phase: 'ongoing', travelStartDate: '2026-11-05', tripId: 'now' }),
    ], before);
    expect(shape(rows)).toEqual(['# now', 'lead now', '# upcoming', 'card later', '# past', 'card old']);
  });

  it('keeps a second trip under way with the first, not under "upcoming"', () => {
    const rows = journeyRows([
      trip({ travelStartDate: '2026-12-10', tripId: 'later' }),
      trip({ phase: 'ongoing', travelStartDate: '2026-11-05', tripId: 'a' }),
      trip({ phase: 'ongoing', travelStartDate: '2026-11-07', tripId: 'b' }),
    ], before);
    expect(shape(rows)).toEqual(['# now', 'lead a', 'card b', '# upcoming', 'card later']);
  });

  it('calls the lead "your next trip" when nothing is under way', () => {
    const rows = journeyRows([trip({ tripId: 'a' }), trip({ travelStartDate: '2027-01-01', tripId: 'b' })], before);
    expect(rows.map((row) => row.key)).toEqual(['section:next', 'lead:a', 'section:upcoming', 'card:b']);
  });

  it('gives every row a stable unique key', () => {
    const rows = journeyRows([trip({ phase: 'ongoing', tripId: 'a' }), trip({ phase: 'ongoing', tripId: 'b' }), trip({ phase: 'past', tripId: 'c' })], before);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });

  it('lists a saved trip under "happening now" once it is under way, whatever was saved', () => {
    const rows = journeyRows([trip({ phase: 'upcoming', tripId: 'a' }), trip({ travelStartDate: '2027-01-01', travelEndDate: '2027-01-05', tripId: 'b' })], at(2026, 11, 16));
    expect(shape(rows)).toEqual(['# now', 'lead a', '# upcoming', 'card b']);
  });

  it('moves a trip that has ended to "past", whatever was saved', () => {
    const rows = journeyRows([trip({ phase: 'ongoing', tripId: 'a' })], at(2026, 11, 25));
    expect(shape(rows)).toEqual(['# past', 'card a']);
  });

  it('has no rows and no headings without trips', () => {
    expect(journeyRows([], before)).toEqual([]);
    expect(journeyRows([trip({ phase: 'past', tripId: 'p' })], before).map((row) => row.key)).toEqual(['section:past', 'card:p']);
  });
});

describe('shownVisaStatus', () => {
  it('shows the stored status only when a visa is needed', () => {
    expect(shownVisaStatus({ visaRequired: true, visaStatus: 'Submitted' })).toBe('Submitted');
    expect(shownVisaStatus({ visaRequired: false, visaStatus: 'Submitted' })).toBe('Not Required');
  });
});
