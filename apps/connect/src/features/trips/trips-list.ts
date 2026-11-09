/** The download of the tour manager's trip list during this session. */
export type TripsFetch = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded' } | { kind: 'failed' };

/** What the phone can say about the trip list right now. */
export type TripsListStatus =
  /** The list saved on this phone is still being read. */
  | { kind: 'reading' }
  /** Nothing saved yet; the first download is running (or about to). */
  | { kind: 'loading' }
  /** Nothing saved, and no connection to download it. */
  | { kind: 'offline' }
  /** Nothing to show, and the download failed. */
  | { kind: 'failed' }
  /** The office lists no trips for this tour manager. */
  | { kind: 'empty' }
  | { kind: 'ready' };

export const NO_TRIPS = 'No trips yet. A trip shows here once Operations assigns you to it and starts the app for that trip.';
export const NO_TRIPS_OFFLINE = 'Your trips are not on this phone yet. Connect to the internet to load them.';
export const TRIPS_LOAD_FAILED = 'Could not load your trips. Pull down to try again.';
const TRIPS_REFRESH_FAILED = 'Could not refresh your trips. Showing the saved list.';

export function tripsListStatus(input: {
  canReachServer: boolean;
  count: number;
  fetch: TripsFetch;
  /** A list from the server is saved on the phone (even an empty one). */
  hasSavedList: boolean;
  /** The phone's saved list has been read. */
  read: boolean;
}): TripsListStatus {
  if (!input.read) return { kind: 'reading' };
  if (input.count > 0) return { kind: 'ready' };
  if (input.fetch.kind === 'loading') return { kind: 'loading' };
  if (input.fetch.kind === 'failed') return { kind: 'failed' };
  if (input.hasSavedList) return { kind: 'empty' };
  // Never fetched: the provider starts the download as soon as the server can be reached.
  return input.canReachServer ? { kind: 'loading' } : { kind: 'offline' };
}

/** Still finding out whether there are trips, so the screen holds their place. */
export const tripsPending = (status: TripsListStatus) => status.kind === 'reading' || status.kind === 'loading';

/** The words for a failed download, if the last one failed. */
export function tripsProblemText(fetch: TripsFetch, hasTrips: boolean) {
  if (fetch.kind !== 'failed') return null;
  return hasTrips ? TRIPS_REFRESH_FAILED : TRIPS_LOAD_FAILED;
}
