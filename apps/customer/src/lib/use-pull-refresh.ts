import { useEffect, useState } from 'react';

import { haptic } from './haptic';

/** Long enough to read as an answer rather than a flicker. */
export const MIN_SPIN_MS = 600;
/** Offline (or a hanging 3G line) the spinner gives up; the freshness line already says why. */
const MAX_SPIN_MS = 3500;

/**
 * Pull to refresh for screens fed by a live subscription. The data is already live, so a pull
 * re-confirms it: a light tap as the pull lets go, then the spinner stays until the connection
 * has answered (and at least `MIN_SPIN_MS`), or gives up after a few seconds without one.
 */
export function usePullRefresh(live: boolean) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [minimumPassed, setMinimumPassed] = useState(false);

  useEffect(() => {
    if (startedAt === null) return;
    const min = setTimeout(() => setMinimumPassed(true), MIN_SPIN_MS);
    const max = setTimeout(() => setStartedAt(null), MAX_SPIN_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
  }, [startedAt]);

  const refreshing = startedAt !== null && !(minimumPassed && live);
  return {
    onRefresh: () => {
      haptic('light');
      setMinimumPassed(false);
      setStartedAt(Date.now());
    },
    refreshing,
  };
}
