import type { TripSummary } from '@citius/backend/customer';

import type { I18n } from '@/i18n/i18n';

import { tripNights } from './cover';
import type { TripTiming } from './model';

/** The words for a trip's timing pill: a countdown, the day of the trip, or past. */
export function timingText(i18n: I18n, timing: TripTiming) {
  switch (timing.kind) {
    case 'countdown':
      if (timing.days === 0) return i18n.t('countdown.today');
      if (timing.days === 1) return i18n.t('countdown.tomorrow');
      return i18n.tn('countdown.days', timing.days);
    case 'progress':
      return i18n.t('progress.day', { day: timing.day, total: timing.total });
    case 'done':
      return i18n.t('phase.past');
    default:
      return i18n.t('journeys.datesTbc');
  }
}

/** The trip's dates in the traveller's language, or "Dates to be confirmed". */
export function tripDates(i18n: I18n, trip: Pick<TripSummary, 'travelEndDate' | 'travelStartDate'>) {
  return i18n.dayRange(trip.travelStartDate, trip.travelEndDate) ?? i18n.t('journeys.datesTbc');
}

/** Dates and nights: "10 Sept – 21 Sept 2026 · 11 nights". */
export function datesAndNights(i18n: I18n, trip: Pick<TripSummary, 'travelEndDate' | 'travelStartDate'>) {
  const nights = tripNights(trip.travelStartDate, trip.travelEndDate);
  return [tripDates(i18n, trip), nights ? i18n.tn('journeys.nights', nights) : null].filter(Boolean).join(' · ');
}
