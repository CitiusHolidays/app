import { type NotificationRow, staffApi } from '@citius/backend';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';

import { useStaffSession } from '@/features/gate/session';
import { useStoredValue } from '@/lib/app-store';

interface InboxCache {
  rows: NotificationRow[];
  savedAt: number;
}

/** The notifications list, live when online and from the last saved copy when not. Read-only. */
export function useInbox() {
  const { gate, online } = useStaffSession();
  const live = useQuery(staffApi.listNotifications.ref, online && gate.kind === 'staff' && !gate.offline ? { limit: 50 } : 'skip');
  const [cache, setCache, loaded] = useStoredValue<InboxCache | null>('inbox:list', null);
  useEffect(() => {
    if (live) setCache({ rows: live, savedAt: Date.now() });
    // setCache writes the shared store, not this component's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);
  return { loaded: loaded || live !== undefined, rows: live ?? cache?.rows ?? [], savedAt: live ? null : (cache?.savedAt ?? null) };
}
