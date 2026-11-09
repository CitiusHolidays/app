/**
 * The `data` a server refusal (a `ConvexError`) carries, or undefined for any other failure: a
 * dropped connection, a timeout. Read through `in`, so nothing is assumed about the error's shape.
 */
export function refusalData(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'data' in error ? error.data : undefined;
}

/** The refusal's words when the server sent a string, or '' otherwise. */
export function refusalText(error: unknown) {
  const data = refusalData(error);
  return typeof data === 'string' ? data : '';
}
