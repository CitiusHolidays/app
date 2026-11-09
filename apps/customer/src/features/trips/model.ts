import type { TripDetail, TripSummary } from '@citius/backend/customer';
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

/** Where the traveller is relative to the trip: days to go, which day of the trip, or over. */
export function tripTiming(trip: Pick<TripSummary, 'phase' | 'travelEndDate' | 'travelStartDate'>, now: number): TripTiming {
  const start = dayStart(trip.travelStartDate);
  const end = dayStart(trip.travelEndDate) ?? start;
  const today = todayStart(now);
  if (trip.phase === 'past') return { kind: 'done' };
  if (start === null || end === null) return { kind: 'unknown' };
  if (today < start) return { days: daysBetween(today, start), kind: 'countdown' };
  if (today > end) return { kind: 'done' };
  return { day: daysBetween(start, today) + 1, kind: 'progress', total: daysBetween(start, end) + 1 };
}

/** Trips still to come or under way, soonest first; past trips, most recent first. */
export function splitTrips(trips: readonly TripSummary[]) {
  const byStart = (a: TripSummary, b: TripSummary) => (a.travelStartDate ?? '9999').localeCompare(b.travelStartDate ?? '9999');
  const active = trips.filter((trip) => trip.phase !== 'past').sort(byStart);
  const past = trips.filter((trip) => trip.phase === 'past').sort((a, b) => byStart(b, a));
  return { active, past };
}

/** The trip the home screen leads with: one under way, else the next to start. */
export function featuredTrip(trips: readonly TripSummary[]) {
  const { active } = splitTrips(trips);
  return active.find((trip) => trip.phase === 'ongoing') ?? active[0] ?? null;
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
export function journeyRows(trips: readonly TripSummary[]): JourneyRow[] {
  const lead = featuredTrip(trips);
  const { active, past } = splitTrips(trips);
  const rest = active.filter((trip) => trip.tripId !== lead?.tripId);
  // The lead is the first trip under way when there is one, so any other trip under way joins it.
  const leadOngoing = lead?.phase === 'ongoing';
  const alsoNow = rest.filter((trip) => trip.phase === 'ongoing');
  const upcoming = rest.filter((trip) => trip.phase !== 'ongoing');
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
