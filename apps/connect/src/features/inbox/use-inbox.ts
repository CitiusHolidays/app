import { type NotificationRow, staffApi } from '@citius/backend';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';

import { useCanReachServer } from '@/features/gate/reach';
import { useStoredValue } from '@/lib/app-store';

interface InboxCache {
  rows: NotificationRow[];
  savedAt: number;
}

/**
 * Where the inbox list comes from:
 * - `reading`: this phone's saved copy is still being read.
 * - `fetching`: nothing is saved yet and the first answer from the server is on its way.
 * - `unreachable`: nothing is saved and the server cannot be reached (offline), so nothing to show.
 * - `cached`: the copy saved on this phone at `savedAt`.
 * - `live`: the server's current list.
 */
export type InboxState =
  | { kind: 'reading' }
  | { kind: 'fetching' }
  | { kind: 'unreachable' }
  | { kind: 'cached'; rows: NotificationRow[]; savedAt: number }
  | { kind: 'live'; rows: NotificationRow[] };

export function inboxState(input: {
  cache: InboxCache | null;
  cacheRead: boolean;
  canFetch: boolean;
  live: NotificationRow[] | undefined;
}): InboxState {
  if (input.live) return { kind: 'live', rows: input.live };
  if (!input.cacheRead) return { kind: 'reading' };
  if (input.cache) return { kind: 'cached', rows: input.cache.rows, savedAt: input.cache.savedAt };
  return input.canFetch ? { kind: 'fetching' } : { kind: 'unreachable' };
}

/**
 * The notifications list, live when online and from the last saved copy when not. `rows`,
 * `savedAt` and `loaded` are read from `state`, for screens that only need the list.
 */
export function useInbox() {
  const canFetch = useCanReachServer();
  const live = useQuery(staffApi.listNotifications.ref, canFetch ? { limit: 50 } : 'skip');
  const [cache, setCache, cacheRead] = useStoredValue<InboxCache | null>('inbox:list', null);
  useEffect(() => {
    if (live) setCache({ rows: live, savedAt: Date.now() });
    // setCache writes the shared store, not this component's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);
  const state = inboxState({ cache, cacheRead, canFetch, live });
  const hasRows = state.kind === 'live' || state.kind === 'cached';
  return {
    /** True once the list is known: live, saved, or known to be out of reach. */
    loaded: state.kind !== 'reading' && state.kind !== 'fetching',
    rows: hasRows ? state.rows : [],
    savedAt: state.kind === 'cached' ? state.savedAt : null,
    state,
  };
}
