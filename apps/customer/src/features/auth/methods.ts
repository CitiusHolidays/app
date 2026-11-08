import { SIGN_IN_DEVICE_HEADER } from '@citius/backend/customer';
import * as SecureStore from 'expo-secure-store';

import { clients } from '@/lib/clients';

import { sha256Hex, signInDevice } from './sign-in-device';

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
export async function requestEmailLink(email: string, inviteToken?: string | null): Promise<RequestResult> {
  if (!clients) return { ok: false, reason: 'network' };
  try {
    const { digest } = await signInDevice();
    // An invited traveller is never held back by the server's domain or volume limits; the
    // invite's hash (what the server stores) shows it is real without sending the token.
    const inviteTokenHash = inviteToken ? await sha256Hex(inviteToken) : undefined;
    const { error } = await clients.auth.signIn.magicLink({
      email: email.trim().toLowerCase(),
      metadata: inviteTokenHash ? { deviceDigest: digest, inviteTokenHash } : { deviceDigest: digest },
    });
    return error ? failure(error.status) : { ok: true };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/** Links this phone has already turned into a session, as SHA-256 digests (never the tokens). */
const OPENED_LINKS_KEY = 'citius.openedSignInLinks';
const OPENED_LINKS_KEPT = 5;

async function openedLinks(): Promise<string[]> {
  try {
    const saved: unknown = JSON.parse((await SecureStore.getItemAsync(OPENED_LINKS_KEY)) ?? '[]');
    return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

async function rememberOpenedLink(digest: string) {
  try {
    const kept = [digest, ...(await openedLinks()).filter((item) => item !== digest)].slice(0, OPENED_LINKS_KEPT);
    await SecureStore.setItemAsync(OPENED_LINKS_KEY, JSON.stringify(kept));
  } catch {
    // Only a convenience for a repeated link; signing in has already worked.
  }
}

async function openLink(token: string, signedIn: boolean): Promise<RequestResult> {
  if (!clients) return { ok: false, reason: 'network' };
  try {
    const digest = await sha256Hex(token);
    if (signedIn && (await openedLinks()).includes(digest)) return { ok: true };
    const { secret } = await signInDevice();
    const { error } = await clients.auth.magicLink.verify({
      fetchOptions: { headers: { [SIGN_IN_DEVICE_HEADER]: secret } },
      query: { token },
    });
    if (error) return failure(error.status);
    await rememberOpenedLink(digest);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

const opening = new Map<string, Promise<RequestResult>>();

/**
 * Turns the link's token into a session. The app calls the server itself, so the session cookie
 * lands in SecureStore through the Expo plugin and never travels in a URL. The phone's secret
 * goes with it: a link opened on another phone than the one that asked for it is refused.
 *
 * The same link can reach the app more than once: Android hands the launching link back when it
 * reopens the app from Recents, and the website's button can be tapped again. Each link works
 * once, so asking the server a second time would tell someone who is already signed in that their
 * link was "already used". A link this phone has already opened, arriving while signed in, is
 * therefore answered here, and two arrivals at the same moment share one request.
 */
export function verifyEmailLink(token: string, { signedIn = false }: { signedIn?: boolean } = {}): Promise<RequestResult> {
  const running = opening.get(token);
  if (running) return running;
  const request = openLink(token, signedIn).finally(() => opening.delete(token));
  opening.set(token, request);
  return request;
}
