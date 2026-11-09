import { refusalText } from '@/lib/refusal';

/** The server's refusal codes that mean this account may no longer read trip data. */
const REVOKED_CODES = new Set(['FORBIDDEN', 'NOT_STAFF']);

export function isAccessRevokedError(error: unknown) {
  return REVOKED_CODES.has(refusalText(error));
}
