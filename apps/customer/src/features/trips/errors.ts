import { CUSTOMER_ERRORS } from '@citius/backend/customer';

import type { MessageKey } from '@/i18n/locales/en';

/** The server's refusal code, from a ConvexError's string data. */
export function serverCode(error: unknown) {
  const data = typeof error === 'object' && error !== null ? (error as { data?: unknown }).data : undefined;
  return typeof data === 'string' ? data : null;
}

export function inviteErrorMessage(error: unknown): MessageKey {
  switch (serverCode(error)) {
    case CUSTOMER_ERRORS.alreadyOnTrip:
      return 'invite.alreadyOnTrip';
    case CUSTOMER_ERRORS.inviteMinor:
      return 'invite.minorError';
    case CUSTOMER_ERRORS.inviteInvalid:
      return 'invite.invalidBody';
    default:
      return 'invite.failed';
  }
}
