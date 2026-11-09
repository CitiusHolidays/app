import type { TripPack } from './trip-pack';

/**
 * Where one trip's pack stands on this phone. Kept per trip, so a problem with one trip never
 * shows on another.
 */
export type PackStatus =
  /** The saved copy is still being read from the phone. */
  | { kind: 'loading' }
  /** Nothing saved, and no download has been tried yet (offline, say). */
  | { kind: 'none' }
  /** Nothing saved; the first download is running. */
  | { kind: 'fetching' }
  /** Nothing saved; the download failed. */
  | { kind: 'failed' }
  /** Operations stopped the app for this trip, so nothing about it stays on the phone. */
  | { kind: 'off' }
  /** The saved copy, current as far as the phone knows. */
  | { kind: 'ready'; pack: TripPack }
  /** The saved copy, shown after a refresh failed. */
  | { kind: 'stale'; pack: TripPack };

export type PackAction =
  /** The saved copy was read from the phone (null when there is none). */
  | { pack: TripPack | null; type: 'read' }
  | { type: 'fetch' }
  | { pack: TripPack; type: 'fetched' }
  | { type: 'fetchFailed' }
  | { type: 'off' };

const LOADING: PackStatus = { kind: 'loading' };

export function packReducer(status: PackStatus = LOADING, action: PackAction): PackStatus {
  switch (action.type) {
    case 'read':
      if (!action.pack) {
        // A download already under way, or a stopped pilot, says more than "nothing saved".
        return status.kind === 'fetching' || status.kind === 'off' ? status : { kind: 'none' };
      }
      // Reading the same copy again keeps the note that its refresh failed.
      return status.kind === 'stale' && status.pack.savedAt === action.pack.savedAt ? status : { kind: 'ready', pack: action.pack };
    case 'fetch':
      // A saved copy stays on screen while it refreshes.
      return status.kind === 'ready' || status.kind === 'stale' ? status : { kind: 'fetching' };
    case 'fetched':
      return { kind: 'ready', pack: action.pack };
    case 'fetchFailed':
      return status.kind === 'ready' || status.kind === 'stale' ? { kind: 'stale', pack: status.pack } : { kind: 'failed' };
    case 'off':
      return { kind: 'off' };
  }
}

export const packOf = (status: PackStatus) => (status.kind === 'ready' || status.kind === 'stale' ? status.pack : null);

/** Still finding out whether there is a pack to show. */
export const packPending = (status: PackStatus) => status.kind === 'loading' || status.kind === 'fetching';

/** Said beside a pack that is shown but could not be updated. */
export const STALE_PACK_PROBLEM = 'Could not update the trip pack. Showing the saved copy.';
