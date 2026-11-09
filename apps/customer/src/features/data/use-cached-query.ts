import { useQuery } from 'convex/react';
import type { FunctionReference } from 'convex/server';
import { useEffect, useState } from 'react';

import { useStoredValue } from '@/lib/app-store';

import { type Cached, cachedResult, type CachedResult } from './cached-result';

export type { CachedResult, CacheStatus } from './cached-result';

/**
 * A Convex query that opens instantly from the encrypted store and keeps working offline: the
 * last answer is shown at once (on a slow 3G link the live answer can take seconds), the live
 * answer replaces it as soon as it arrives, and each new answer is saved for next time.
 */
export function useCachedQuery<Args extends Record<string, unknown>, T>(
  cacheKey: string | null,
  ref: FunctionReference<'query', 'public', Args, T>,
  args: Args | 'skip'
): CachedResult<T> {
  const live = useQuery(ref, args as never) as T | undefined;
  const [cached, setCached, loaded] = useStoredValue<Cached<T> | null>(cacheKey, null);
  // The last live answer for this key, remembered during render (React's "previous value" pattern).
  const [held, setHeld] = useState<{ key: string | null; value: T } | null>(null);
  if (live !== undefined && (held?.key !== cacheKey || held.value !== live)) setHeld({ key: cacheKey, value: live });
  useEffect(() => {
    if (live !== undefined && cacheKey) void setCached({ savedAt: Date.now(), value: live });
    // Convex returns a new object only when the answer changes, so this writes once per change.
  }, [cacheKey, live, setCached]);
  const last = held?.key === cacheKey ? held.value : undefined;
  return cachedResult({ asking: args !== 'skip', cached, held: last, live, loaded });
}
