/** The server's refusal codes that mean this account may no longer read trip data. */
const REVOKED_CODES = new Set(['FORBIDDEN', 'NOT_STAFF']);

export function isAccessRevokedError(error: unknown) {
  const data = typeof error === 'object' && error !== null ? (error as { data?: unknown }).data : undefined;
  return typeof data === 'string' && REVOKED_CODES.has(data);
}
