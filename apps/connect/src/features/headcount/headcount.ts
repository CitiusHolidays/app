import type { RosterEntry } from '@/features/trip-pack/trip-pack';

export interface HeadcountStop {
  id: string;
  label: string;
  present: string[];
  startedAt: number;
}

/** One trip, one local day. Kept on the device only; it never syncs. */
export interface HeadcountState {
  day: string;
  jobCardId: string;
  stops: HeadcountStop[];
}

export interface HeadcountSummary {
  expected: number;
  missing: RosterEntry[];
  present: number;
  stopLabel: string;
}

export function localDay(now: number) {
  const date = new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export const headcountKey = (jobCardId: string, day: string) => `headcount:${jobCardId}:${day}`;

export function startHeadcount(jobCardId: string, now: number): HeadcountState {
  return {
    day: localDay(now),
    jobCardId,
    stops: [{ id: `stop-${now}`, label: 'Start of day', present: [], startedAt: now }],
  };
}

function currentStop(state: HeadcountState) {
  const stop = state.stops.at(-1);
  if (!stop) {
    throw new Error('A headcount always has a stop');
  }
  return stop;
}

export function togglePresent(state: HeadcountState, travellerId: string): HeadcountState {
  const stop = currentStop(state);
  const present = stop.present.includes(travellerId)
    ? stop.present.filter((id) => id !== travellerId)
    : [...stop.present, travellerId];
  return { ...state, stops: [...state.stops.slice(0, -1), { ...stop, present }] };
}

/** Starts a new stop with nobody marked. Earlier stops stay for the day's record. */
export function newStop(state: HeadcountState, label: string, now: number): HeadcountState {
  const trimmed = label.trim() || `Stop ${state.stops.length + 1}`;
  return { ...state, stops: [...state.stops, { id: `stop-${now}`, label: trimmed, present: [], startedAt: now }] };
}

export function summarize(state: HeadcountState, roster: RosterEntry[], batchId?: string): HeadcountSummary {
  const stop = currentStop(state);
  const present = new Set(stop.present);
  const counted = roster.filter((entry) => entry.travelling && (!batchId || entry.batchId === batchId));
  const missing = counted.filter((entry) => !present.has(entry.id));
  return {
    expected: counted.length,
    missing,
    present: counted.length - missing.length,
    stopLabel: stop.label,
  };
}

/**
 * The Today answer: "38 of 41 here", or "All 41 here". Over a roster that did not fully load,
 * "All" would be a promise the app cannot keep, so it is never said.
 */
export function headcountAnswer(summary: Pick<HeadcountSummary, 'expected' | 'present'>, roster: { complete: boolean } = { complete: true }) {
  if (roster.complete && summary.expected > 0 && summary.present === summary.expected) {
    return `All ${summary.expected} here`;
  }
  return `${summary.present} of ${summary.expected} here`;
}

/** Shown beside any count taken over a roster that did not fully load. */
export const PARTIAL_ROSTER_NOTICE = 'Not every traveller could be loaded. Refresh the trip pack before relying on this count.';
