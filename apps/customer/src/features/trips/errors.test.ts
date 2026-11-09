import { CUSTOMER_ERRORS } from '@citius/backend/customer';
import { ConvexError } from 'convex/values';

import { inviteErrorMessage, serverCode } from './errors';

describe('serverCode', () => {
  it('reads a known refusal code from a ConvexError', () => {
    expect(serverCode(new ConvexError(CUSTOMER_ERRORS.deletionReauth))).toBe(CUSTOMER_ERRORS.deletionReauth);
  });

  it('is null for unknown codes and other failures', () => {
    expect(serverCode(new ConvexError('SOMETHING_ELSE'))).toBeNull();
    expect(serverCode(new Error(CUSTOMER_ERRORS.deletionReauth))).toBeNull();
    expect(serverCode({ data: CUSTOMER_ERRORS.deletionReauth })).toBeNull();
    expect(serverCode(null)).toBeNull();
  });
});

describe('inviteErrorMessage', () => {
  it('names the refusal', () => {
    expect(inviteErrorMessage(new ConvexError(CUSTOMER_ERRORS.alreadyOnTrip))).toBe('invite.alreadyOnTrip');
    expect(inviteErrorMessage(new ConvexError(CUSTOMER_ERRORS.inviteMinor))).toBe('invite.minorError');
    expect(inviteErrorMessage(new ConvexError(CUSTOMER_ERRORS.inviteInvalid))).toBe('invite.invalidBody');
  });

  it('falls back to a general failure', () => {
    expect(inviteErrorMessage(new Error('network'))).toBe('invite.failed');
  });
});
