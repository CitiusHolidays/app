import type { TripDetail, TripPhase, TripSummary } from '@citius/backend/customer';
import type { StatusKind } from '@citius/ui';

import { parseCalendarDay } from '@/lib/calendar-day';

/** Local midnight of a YYYY-MM-DD calendar day, or null. */
function dayStart(value: string | null) {
  const day = parseCalendarDay(value);
  return day ? new Date(day.year, day.month, day.day).getTime() : null;
}

function todayStart(now: number) {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole calendar days from `from` to `to` (daylight-saving safe). */
function daysBetween(from: number, to: number) {
  return Math.round((to - from) / 86_400_000);
}

export type TripTiming =
  | { kind: 'countdown'; days: number }
  | { kind: 'progress'; day: number; total: number }
  | { kind: 'done' }
  | { kind: 'unknown' };

/**
 * Where a trip stands for the traveller: its phase and the timing shown with it, decided together
 * so the two never disagree (a "Completed" pill under "Happening now", or "Day 1" under "Your next
 * trip").
 */
export type TripStage =
  | { phase: 'upcoming'; timing: Extract<TripTiming, { kind: 'countdown' | 'unknown' }> }
  | { phase: 'ongoing'; timing: Extract<TripTiming, { kind: 'progress' | 'unknown' }> }
  | { phase: 'past'; timing: { kind: 'done' } };

const PHASE_ORDER: Record<TripPhase, number> = { ongoing: 1, past: 2, upcoming: 0 };

/** The trip's timing by the phone's own calendar day, from its dates alone. */
function timingByDates(trip: Pick<TripSummary, 'travelEndDate' | 'travelStartDate'>, now: number): TripTiming {
  const start = dayStart(trip.travelStartDate);
  const end = dayStart(trip.travelEndDate) ?? start;
  const today = todayStart(now);
  if (start === null || end === null) return { kind: 'unknown' };
  if (today < start) return { days: daysBetween(today, start), kind: 'countdown' };
  if (today > end) return { kind: 'done' };
  return { day: daysBetween(start, today) + 1, kind: 'progress', total: daysBetween(start, end) + 1 };
}

/**
 * The server works out `phase` on India's calendar at the hour it was asked; the phone may be in
 * another time zone, or showing an answer saved days ago. A trip is as far along as either clock
 * says (a trip never steps back), and its timing is then read to match that phase.
 */
export function tripStage(trip: Pick<TripSummary, 'phase' | 'travelEndDate' | 'travelStartDate'>, now: number): TripStage {
  const timing = timingByDates(trip, now);
  const byDates: TripPhase = timing.kind === 'progress' ? 'ongoing' : timing.kind === 'done' ? 'past' : 'upcoming';
  const phase = PHASE_ORDER[byDates] > PHASE_ORDER[trip.phase] ? byDates : trip.phase;
  if (phase === 'past') return { phase, timing: { kind: 'done' } };
  if (phase === 'upcoming') return { phase, timing: timing.kind === 'countdown' ? timing : { kind: 'unknown' } };
  if (timing.kind === 'progress') return { phase, timing };
  // India has reached the first day before this phone's calendar has: the trip is on its first day.
  if (timing.kind === 'countdown') {
    const start = dayStart(trip.travelStartDate) ?? 0;
    const end = dayStart(trip.travelEndDate) ?? start;
    return { phase, timing: { day: 1, kind: 'progress', total: daysBetween(start, end) + 1 } };
  }
  return { phase, timing: { kind: 'unknown' } };
}

/** Where the traveller is relative to the trip: days to go, which day of the trip, or over. */
export function tripTiming(trip: Pick<TripSummary, 'phase' | 'travelEndDate' | 'travelStartDate'>, now: number): TripTiming {
  return tripStage(trip, now).timing;
}

/** Trips still to come or under way, soonest first; past trips, most recent first. */
export function splitTrips(trips: readonly TripSummary[], now: number) {
  const byStart = (a: TripSummary, b: TripSummary) => (a.travelStartDate ?? '9999').localeCompare(b.travelStartDate ?? '9999');
  const active = trips.filter((trip) => tripStage(trip, now).phase !== 'past').sort(byStart);
  const past = trips.filter((trip) => tripStage(trip, now).phase === 'past').sort((a, b) => byStart(b, a));
  return { active, past };
}

/** The trip the home screen leads with: one under way, else the next to start. */
export function featuredTrip(trips: readonly TripSummary[], now: number) {
  const { active } = splitTrips(trips, now);
  return active.find((trip) => tripStage(trip, now).phase === 'ongoing') ?? active[0] ?? null;
}

export type JourneySection = 'now' | 'next' | 'upcoming' | 'past';

export type JourneyRow =
  | { key: string; kind: 'lead' | 'card'; trip: TripSummary }
  | { key: string; kind: 'section'; section: JourneySection };

/**
 * The Journeys screen as one flat list, so it can be virtualised. The lead trip comes first under
 * "Happening now" (with any other trip under way) or "Your next trip", then the remaining upcoming
 * trips, then past ones. Headings appear only above trips.
 */
export function journeyRows(trips: readonly TripSummary[], now: number): JourneyRow[] {
  const lead = featuredTrip(trips, now);
  const { active, past } = splitTrips(trips, now);
  const rest = active.filter((trip) => trip.tripId !== lead?.tripId);
  const ongoing = (trip: TripSummary) => tripStage(trip, now).phase === 'ongoing';
  // The lead is the first trip under way when there is one, so any other trip under way joins it.
  const leadOngoing = lead ? ongoing(lead) : false;
  const alsoNow = rest.filter(ongoing);
  const upcoming = rest.filter((trip) => !ongoing(trip));
  const rows: JourneyRow[] = [];
  if (lead) {
    const section = leadOngoing ? 'now' : 'next';
    rows.push({ key: `section:${section}`, kind: 'section', section }, { key: `lead:${lead.tripId}`, kind: 'lead', trip: lead });
    for (const trip of alsoNow) rows.push({ key: `card:${trip.tripId}`, kind: 'card', trip });
  }
  for (const [section, list] of [['upcoming', upcoming], ['past', past]] as const) {
    if (list.length === 0) continue;
    rows.push({ key: `section:${section}`, kind: 'section', section });
    for (const trip of list) rows.push({ key: `card:${trip.tripId}`, kind: 'card', trip });
  }
  return rows;
}

const GOOD = new Set(['Received', 'Uploaded', 'Not Required', 'Approved', 'Issued']);
const DANGER = new Set(['Rejected']);
const NEUTRAL = new Set(['Cancelled', 'Refunded', 'Refund Pending']);

/** How a document status word should look: done, needs attention, refused, or settled. */
export function statusKind(status: string | null): StatusKind {
  if (!status) return 'neutral';
  if (GOOD.has(status)) return 'good';
  if (DANGER.has(status)) return 'danger';
  if (NEUTRAL.has(status)) return 'neutral';
  return 'attention';
}

/** The visa status to show: travellers who need no visa read "Not Required", whatever was stored. */
export function shownVisaStatus(row: Pick<TripDetail['documents'][number], 'visaRequired' | 'visaStatus'>) {
  return row.visaRequired ? row.visaStatus : 'Not Required';
}

/** The documents block summary: how many of the shown documents are done. */
export function documentProgress(documents: TripDetail['documents']) {
  let done = 0;
  let total = 0;
  for (const row of documents) {
    for (const status of [row.passportStatus, shownVisaStatus(row), row.ticketStatus]) {
      total += 1;
      if (statusKind(status) === 'good') done += 1;
    }
  }
  return { done, total };
}

/** "Day 3" → 3: the plan's day numbers, so each language words them its own way. */
export function dayNumber(dayLabel: string | null) {
  const match = dayLabel ? /\d+/.exec(dayLabel) : null;
  return match ? Number(match[0]) : null;
}

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/**
 * The invite token from whatever the traveller pastes: the https link from an SMS or email
 * (`…/app/invite#token=…`), the app link (`citius://invite?token=…`), or the bare token.
 */
export function parseInviteToken(text: string) {
  const trimmed = text.trim();
  if (TOKEN.test(trimmed)) return trimmed;
  const match = /[#?&]token=([A-Za-z0-9_-]{43})(?:[&#\s]|$)/.exec(trimmed);
  return match?.[1] ?? null;
}
