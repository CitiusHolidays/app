import { useQuery } from 'convex/react';
import type { FunctionReference } from 'convex/server';
import { useEffect } from 'react';

import { useStoredValue } from '@/lib/app-store';

interface Cached<T> {
  savedAt: number;
  value: T;
}

export interface CachedResult<T> {
  /** The live answer, else the last answer saved on this phone, else undefined. */
  data: T | undefined;
  /** True while the server has not answered and nothing was saved: show placeholders. */
  loading: boolean;
  /** True when `data` is the server's current answer. */
  live: boolean;
  /** When `data` was last confirmed by the server. */
  savedAt: number | null;
}

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
  useEffect(() => {
    if (live !== undefined && cacheKey) {
      void setCached({ savedAt: Date.now(), value: live });
    }
    // Convex returns a new object only when the answer changes, so this writes once per change.
  }, [cacheKey, live, setCached]);
  if (live !== undefined) {
    return { data: live, live: true, loading: false, savedAt: cached?.savedAt ?? null };
  }
  return {
    data: cached?.value,
    live: false,
    loading: !loaded || !cached,
    savedAt: cached?.savedAt ?? null,
  };
}
