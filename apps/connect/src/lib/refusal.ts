/**
 * How the app tells a server refusal (a `ConvexError`) from a failed request, shared by every
 * queue that sends work to the office (the expense outbox, the field sync queue) and by the log
 * and error checks. Read through `in`, so nothing is assumed about the error's shape.
 */

/** A ConvexError carries `data`: the server decided. Anything else (network, timeouts) is retried. */
export function isServerRefusal(error: unknown): error is { data: unknown } {
  return typeof error === 'object' && error !== null && 'data' in error;
}

/** The `data` a server refusal carries, or undefined for any other failure: a dropped connection, a timeout. */
export function refusalData(error: unknown): unknown {
  return isServerRefusal(error) ? error.data : undefined;
}

/** The refusal's words when the server sent a string, or '' otherwise. */
export function refusalText(error: unknown) {
  const data = refusalData(error);
  return typeof data === 'string' ? data : '';
}

/** Plain words for a known refusal, matched on its text; `fallback` for anything else. Server text is never shown raw. */
export function knownRefusal(error: unknown, known: readonly (readonly [RegExp, string])[], fallback: string) {
  const text = refusalText(error);
  return known.find(([pattern]) => pattern.test(text))?.[1] ?? fallback;
}

const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 30 * 60_000;

/** The wait before the next attempt: 30 s, doubling with each failed attempt, at most 30 min. */
export function backoff(attempts: number) {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}
