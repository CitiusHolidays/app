import { useEffect, useState } from 'react';

import { useStoredValue } from '@/lib/app-store';

import { CACHE_SHAPE, cachedResult, type CachedResult, readCached } from './cached-result';

export type { CachedResult, CacheStatus } from './cached-result';

/**
 * Keeps a Convex query's answer on the phone so the screen opens instantly from the encrypted
 * store and keeps working offline: the last answer is shown at once (on a slow 3G link the live
 * answer can take seconds), the live answer replaces it as soon as it arrives, and each new
 * answer is saved for next time.
 *
 * @param live the query's current answer (`useQuery`), undefined until it comes
 * @param asking whether the query is running (not skipped)
 */
export function useCachedAnswer<T>(cacheKey: string | null, live: T | undefined, asking: boolean): CachedResult<T> {
  const [stored, setStored, loaded] = useStoredValue<unknown>(cacheKey, null);
  // The last live answer for this key, remembered during render (React's "previous value" pattern).
  const [held, setHeld] = useState<{ key: string | null; value: T } | null>(null);
  if (live !== undefined && (held?.key !== cacheKey || held.value !== live)) setHeld({ key: cacheKey, value: live });
  useEffect(() => {
    if (live !== undefined && cacheKey) void setStored({ savedAt: Date.now(), shape: CACHE_SHAPE, value: live });
    // Convex returns a new object only when the answer changes, so this writes once per change.
  }, [cacheKey, live, setStored]);
  const last = held?.key === cacheKey ? held.value : undefined;
  return cachedResult({ asking, cached: readCached<T>(stored), held: last, live, loaded });
}
