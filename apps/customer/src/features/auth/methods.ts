import { SIGN_IN_DEVICE_HEADER } from '@citius/backend/customer';

import { clients } from '@/lib/clients';

import { signInDevice } from './sign-in-device';

/**
 * How a traveller can sign in. The owner decided on email link and SMS, the traveller's choice
 * (7 Nov 2026). SMS goes through sent.dm, which is not set up yet, so it is listed but not offered.
 *
 * Switching SMS on later, without changing the screens' shape:
 * - Website: add Better Auth's `phoneNumber` plugin with `sendOTP` delivering through sent.dm
 *   (DLT-registered template), and refuse staff numbers as the email link refuses staff emails.
 * - Here: add `phoneNumberClient()` to `createCustomerAuthClient`, implement `requestSmsCode` /
 *   `verifySmsCode` with `auth.phoneNumber.sendOtp` / `auth.phoneNumber.verify`, and set
 *   `available: true` below. The sign-in screen already renders the SMS option from this list.
 */
export type SignInMethodId = 'email' | 'sms';

export const SIGN_IN_METHODS: readonly { available: boolean; id: SignInMethodId }[] = [
  { available: true, id: 'email' },
  { available: false, id: 'sms' },
];

export type RequestResult = { ok: true } | { ok: false; reason: 'rate-limited' | 'network' | 'refused' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string) {
  return EMAIL.test(value.trim());
}

function failure(status: unknown): RequestResult {
  return { ok: false, reason: status === 429 ? 'rate-limited' : 'refused' };
}

/**
 * Emails a one-time sign-in link bound to this phone. The server answers the same whether or not
 * the address is known, is staff, or has asked too often this hour.
 */
export async function requestEmailLink(email: string): Promise<RequestResult> {
  if (!clients) return { ok: false, reason: 'network' };
  try {
    const { digest } = await signInDevice();
    const { error } = await clients.auth.signIn.magicLink({
      email: email.trim().toLowerCase(),
      metadata: { deviceDigest: digest },
    });
    return error ? failure(error.status) : { ok: true };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/**
 * Turns the link's token into a session. The app calls the server itself, so the session cookie
 * lands in SecureStore through the Expo plugin and never travels in a URL. The phone's secret
 * goes with it: a link opened on another phone than the one that asked for it is refused.
 */
export async function verifyEmailLink(token: string): Promise<RequestResult> {
  if (!clients) return { ok: false, reason: 'network' };
  try {
    const { secret } = await signInDevice();
    const { error } = await clients.auth.magicLink.verify({
      fetchOptions: { headers: { [SIGN_IN_DEVICE_HEADER]: secret } },
      query: { token },
    });
    return error ? failure(error.status) : { ok: true };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
