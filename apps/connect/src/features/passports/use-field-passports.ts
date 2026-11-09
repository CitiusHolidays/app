import { type FieldPassports, staffApi } from '@citius/backend';
import { useConvex } from 'convex/react';
import { useEffect, useState } from 'react';

import { useCanReachServer } from '@/features/gate/reach';
import { logEvent } from '@/lib/safe-log';
import { useNow } from '@/lib/use-now';

/** The window can open while the roster is on screen; look again this often. */
const REFRESH_MS = 5 * 60 * 1000;

/**
 * Which travellers in the tour manager's group have a passport the app may open now. Online only
 * and held in memory: it is never saved, so offline there is no answer at all.
 */
export function useFieldPassports(jobCardId: string | null) {
  const convex = useConvex();
  const canReachServer = useCanReachServer();
  const tick = useNow(REFRESH_MS);
  const [answer, setAnswer] = useState<{ jobCardId: string; passports: FieldPassports } | null>(null);

  useEffect(() => {
    if (!(canReachServer && jobCardId)) {
      return;
    }
    let active = true;
    convex
      .query(staffApi.listFieldPassports.ref, { jobCardId, referenceNow: Date.now() })
      .then((passports) => {
        if (active) setAnswer({ jobCardId, passports });
      })
      .catch((error: unknown) => {
        // Not an own assignment on this Job Card, say: no passport actions, nothing else changes.
        logEvent('passports.list-failed', error);
        if (active) setAnswer(null);
      });
    return () => {
      active = false;
    };
  }, [canReachServer, convex, jobCardId, tick]);

  return {
    online: canReachServer,
    passports: canReachServer && answer?.jobCardId === jobCardId ? answer.passports : null,
  };
}
