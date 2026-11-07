import { useNow } from '@/lib/use-now';

const HOUR = 60 * 60 * 1000;

/**
 * The time sent to the server for "is this trip past?". Rounded to the hour so the query's
 * arguments, and with them the live subscription, change once an hour rather than every minute.
 */
export function useReferenceNow() {
  const now = useNow(5 * 60 * 1000);
  return Math.floor(now / HOUR) * HOUR;
}
