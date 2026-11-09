const TRIP_VIEWS = ['roster', 'schedule', 'contacts'] as const;
export type TripView = (typeof TRIP_VIEWS)[number];

/** The Trip tab's `view` route param, read safely: anything unknown opens the roster. */
export function resolveTripView(param: string | string[] | undefined): TripView {
  const value = Array.isArray(param) ? param[0] : param;
  return TRIP_VIEWS.find((view) => view === value) ?? 'roster';
}
