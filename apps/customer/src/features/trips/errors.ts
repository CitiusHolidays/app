import { CUSTOMER_ERRORS } from '@citius/backend/customer';
import { ConvexError } from 'convex/values';

import type { MessageKey } from '@/i18n/locales/en';

export type CustomerErrorCode = (typeof CUSTOMER_ERRORS)[keyof typeof CUSTOMER_ERRORS];

const CODES: ReadonlySet<string> = new Set(Object.values(CUSTOMER_ERRORS));

function isCustomerErrorCode(value: unknown): value is CustomerErrorCode {
  return typeof value === 'string' && CODES.has(value);
}

/** The server's refusal code, from a ConvexError's data; null for any other failure. */
export function serverCode(error: unknown): CustomerErrorCode | null {
  return error instanceof ConvexError && isCustomerErrorCode(error.data) ? error.data : null;
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
