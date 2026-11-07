import { clients } from '@/lib/clients';

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

/** Emails a one-time sign-in link. The server answers the same whether or not the address is known. */
export async function requestEmailLink(email: string): Promise<RequestResult> {
  if (!clients) return { ok: false, reason: 'network' };
  try {
    const { error } = await clients.auth.signIn.magicLink({ email: email.trim().toLowerCase() });
    return error ? failure(error.status) : { ok: true };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/**
 * Turns the link's token into a session. The app calls the server itself, so the session cookie
 * lands in SecureStore through the Expo plugin and never travels in a URL.
 */
export async function verifyEmailLink(token: string): Promise<RequestResult> {
  if (!clients) return { ok: false, reason: 'network' };
  try {
    const { error } = await clients.auth.magicLink.verify({ query: { token } });
    return error ? failure(error.status) : { ok: true };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
