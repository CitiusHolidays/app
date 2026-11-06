/**
 * The only logging helper. It records an event name and an error category, never a message,
 * name, phone number, amount or server text, so logs cannot carry personal data.
 */
export function errorCategory(error: unknown) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    return 'server-refused';
  }
  if (error instanceof TypeError) {
    return 'network';
  }
  return error instanceof Error ? error.name : 'unknown';
}

export function logEvent(event: string, error?: unknown) {
  if (__DEV__) {
    console.warn(`[connect] ${event}${error === undefined ? '' : ` (${errorCategory(error)})`}`);
  }
}
