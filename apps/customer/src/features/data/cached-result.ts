/**
 * The layout of a saved answer. Bump it when a saved answer's shape changes, so an updated app
 * ignores answers an older build saved instead of reading them as the new shape.
 */
export const CACHE_SHAPE = 1;

export interface Cached<T> {
  shape: number;
  savedAt: number;
  value: T;
}

/** A saved answer read from the phone, or null when it is missing or in an older shape. */
export function readCached<T>(stored: unknown): Cached<T> | null {
  if (typeof stored !== 'object' || stored === null || !('value' in stored)) return null;
  const { savedAt, shape } = stored as Partial<Cached<T>>;
  return shape === CACHE_SHAPE && typeof savedAt === 'number' ? (stored as Cached<T>) : null;
}

/**
 * Where the shown answer came from:
 * - `loading`: asking the server, nothing saved yet. Show placeholders.
 * - `live`: the server's current answer.
 * - `saved`: the last answer saved on this phone (offline, or the server is still answering).
 * - `unavailable`: not asking (offline or signed out) and nothing saved. Say so; never shimmer forever.
 */
export type CacheStatus = 'loading' | 'live' | 'saved' | 'unavailable';

export interface CachedResult<T> {
  data: T | undefined;
  status: CacheStatus;
  /** When `data` was last confirmed by the server. */
  savedAt: number | null;
}

export interface CacheInput<T> {
  /** Whether the query is running (not skipped). */
  asking: boolean;
  /** The server's answer for the current arguments, if it has come. */
  live: T | undefined;
  /**
   * The last live answer for this key, kept while new arguments (the hourly reference time) wait
   * for their answer, so the screen stays live instead of flashing "Updated 10:00".
   */
  held: T | undefined;
  cached: Cached<T> | null;
  /** Whether the phone's store has been read for this key. */
  loaded: boolean;
}

export function cachedResult<T>({ asking, cached, held, live, loaded }: CacheInput<T>): CachedResult<T> {
  const savedAt = cached?.savedAt ?? null;
  if (live !== undefined) return { data: live, savedAt, status: 'live' };
  if (asking && held !== undefined) return { data: held, savedAt, status: 'live' };
  if (cached) return { data: cached.value, savedAt, status: 'saved' };
  if (asking || !loaded) return { data: undefined, savedAt, status: 'loading' };
  return { data: undefined, savedAt, status: 'unavailable' };
}
