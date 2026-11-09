import { type NotificationRow, staffApi } from '@citius/backend';
import { useMutation } from 'convex/react';
import { useEffect, useRef } from 'react';

import { logEvent } from '@/lib/safe-log';

/**
 * Marks a notification read on the server the first time its detail screen shows it while online:
 * once per open, never offline. The inbox list is a live query, so the row then moves from New to
 * Earlier by itself. A failure (offline after all, or a refusal) is logged and never shown: the
 * notification simply stays unread, and a refusal must not reach the error boundary, which would
 * treat FORBIDDEN as lost access.
 */
export function useMarkRead(notification: Pick<NotificationRow, 'id' | 'readAt'> | undefined, canReachServer: boolean) {
  const markRead = useMutation(staffApi.markNotificationRead.ref);
  const sentFor = useRef<string | null>(null);
  const id = notification && !notification.readAt ? notification.id : null;
  useEffect(() => {
    if (!id || !canReachServer || sentFor.current === id) return;
    sentFor.current = id;
    markRead({ notificationId: id }).catch((error: unknown) => logEvent('inbox.mark-read-failed', error));
  }, [canReachServer, id, markRead]);
}
