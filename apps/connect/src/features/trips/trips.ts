import type { JobCardRow, PaginationResult } from '@citius/backend';

const DAY_MS = 24 * 60 * 60 * 1000;

export type TripPhase = 'today' | 'upcoming' | 'past' | 'undated';

function dayStart(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime() : null;
}

function todayStart(now: number) {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function tripPhase(trip: Pick<JobCardRow, 'travelStartDate' | 'travelEndDate'>, now: number): TripPhase {
  const start = dayStart(trip.travelStartDate);
  const end = dayStart(trip.travelEndDate) ?? start;
  if (start === null || end === null) {
    return 'undated';
  }
  const today = todayStart(now);
  if (today < start) {
    return 'upcoming';
  }
  return today > end ? 'past' : 'today';
}

/** "Day 3 of 8" while on tour, otherwise null. */
export function dayOfTrip(trip: Pick<JobCardRow, 'travelStartDate' | 'travelEndDate'>, now: number) {
  const start = dayStart(trip.travelStartDate);
  const end = dayStart(trip.travelEndDate);
  if (start === null || end === null || tripPhase(trip, now) !== 'today') {
    return null;
  }
  const day = Math.round((todayStart(now) - start) / DAY_MS) + 1;
  const total = Math.round((end - start) / DAY_MS) + 1;
  return `Day ${day} of ${total}`;
}

const PHASE_ORDER: Record<TripPhase, number> = { past: 3, today: 0, undated: 2, upcoming: 1 };

export function sortTrips<T extends Pick<JobCardRow, 'travelStartDate' | 'travelEndDate'>>(trips: T[], now: number) {
  return [...trips].sort((left, right) => {
    const phaseDelta = PHASE_ORDER[tripPhase(left, now)] - PHASE_ORDER[tripPhase(right, now)];
    if (phaseDelta) {
      return phaseDelta;
    }
    const leftStart = dayStart(left.travelStartDate) ?? 0;
    const rightStart = dayStart(right.travelStartDate) ?? 0;
    return tripPhase(left, now) === 'past' ? rightStart - leftStart : leftStart - rightStart;
  });
}

export function pickDefaultTrip<T extends Pick<JobCardRow, 'travelStartDate' | 'travelEndDate'>>(trips: T[], now: number) {
  return sortTrips(trips, now)[0] ?? null;
}

/**
 * Walks a paginated query whose rows are filtered after pagination (the server drops rows the
 * caller may not see), so a page can be empty while more remain.
 */
export async function collectPages<Row>(
  fetchPage: (cursor: string | null) => Promise<PaginationResult<Row>>,
  maxPages: number
) {
  const rows: Row[] = [];
  let cursor: string | null = null;
  for (let index = 0; index < maxPages; index += 1) {
    const result: PaginationResult<Row> = await fetchPage(cursor);
    rows.push(...result.page);
    if (result.isDone) {
      return { complete: true, rows };
    }
    cursor = result.continueCursor;
  }
  return { complete: false, rows };
}
