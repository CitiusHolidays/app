import type { JobCardRow } from '@citius/backend';

import { collectPages, dayOfTrip, pickDefaultTrip, sortTrips, tripPhase } from './trips';

function trip(id: string, start: string, end: string): JobCardRow {
  return { clientName: id, confirmedPax: 1, destination: 'X', id, jobCode: id, operationsOwnerName: '', status: 'Confirmed', ticketingOwnerName: '', tourManagerName: '', travelBatchCount: 0, travelEndDate: end, travelStartDate: start, updatedAt: '' };
}

const NOW = new Date(2026, 10, 6, 9, 0).getTime();
const past = trip('past', '2026-10-01', '2026-10-05');
const onTour = trip('on', '2026-11-04', '2026-11-11');
const soon = trip('soon', '2026-11-20', '2026-11-25');
const later = trip('later', '2026-12-20', '2026-12-25');
const undated = trip('undated', '', '');

describe('trips', () => {
  it('places each trip relative to today', () => {
    expect(tripPhase(onTour, NOW)).toBe('today');
    expect(tripPhase(soon, NOW)).toBe('upcoming');
    expect(tripPhase(past, NOW)).toBe('past');
    expect(tripPhase(undated, NOW)).toBe('undated');
  });

  it('counts the day of the trip', () => {
    expect(dayOfTrip(onTour, NOW)).toBe('Day 3 of 8');
    expect(dayOfTrip(soon, NOW)).toBeNull();
  });

  it('orders trips: on tour now, then soonest upcoming, then undated, then most recent past', () => {
    expect(sortTrips([past, later, undated, soon, onTour], NOW).map((t) => t.id)).toEqual(['on', 'soon', 'later', 'undated', 'past']);
  });

  it('defaults to the trip on tour today, else the next one', () => {
    expect(pickDefaultTrip([soon, onTour], NOW)?.id).toBe('on');
    expect(pickDefaultTrip([past, later, soon], NOW)?.id).toBe('soon');
    expect(pickDefaultTrip([], NOW)).toBeNull();
  });

  it('collects filtered pages until done, within a page budget', async () => {
    const pages = [
      { continueCursor: 'c1', isDone: false, page: [] as string[] },
      { continueCursor: 'c2', isDone: false, page: ['a'] },
      { continueCursor: 'c3', isDone: true, page: ['b'] },
    ];
    const cursors: (string | null)[] = [];
    const rows = await collectPages(async (cursor) => {
      cursors.push(cursor);
      return pages[cursors.length - 1]!;
    }, 10);
    expect(rows).toEqual({ complete: true, rows: ['a', 'b'] });
    expect(cursors).toEqual([null, 'c1', 'c2']);
    const partial = await collectPages(async () => ({ continueCursor: 'x', isDone: false, page: [1] }), 2);
    expect(partial).toEqual({ complete: false, rows: [1, 1] });
  });
});
