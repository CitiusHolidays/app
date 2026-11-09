/**
 * Where the sign-in screen sends the traveller once a session is live. Kept as one pure decision so
 * every input that steers it is visible in one place and covered by a test.
 */

/** Screens that ask for an email link and want the traveller back afterwards. */
export type ReturnPath = '/delete-account';

/** A screen waiting for the traveller to come back from an email link. */
export interface ReturnTo {
  path: ReturnPath;
  /** Epoch ms. The link it waits for works for 10 minutes, so the note is dropped soon after. */
  until: number;
}

/** How long a return note outlives the link it was written for (10 minutes, plus time to send). */
export const RETURN_TO_TTL_MS = 15 * 60_000;

const RETURN_PATHS: readonly ReturnPath[] = ['/delete-account'];

export function returnToFor(path: ReturnPath, now: number): ReturnTo {
  return { path, until: now + RETURN_TO_TTL_MS };
}

/**
 * The stored note, if it is still current. Anything else on disk (an expired note, or the bare
 * path string older builds saved) reads as no note.
 */
export function currentReturnTo(stored: unknown, now: number): ReturnPath | null {
  if (typeof stored !== 'object' || stored === null) return null;
  const { path, until } = stored as Partial<ReturnTo>;
  if (typeof until !== 'number' || until <= now) return null;
  return RETURN_PATHS.find((candidate) => candidate === path) ?? null;
}

/** Where an email link stands on this screen. */
export type LinkState =
  | { kind: 'none' }
  | { kind: 'opening' }
  | { kind: 'opened' }
  | { kind: 'failed'; reason: 'network' | 'refused' };

export type AfterSignIn =
  | { kind: 'stay' }
  | { kind: 'back' }
  | { kind: 'home' }
  | { kind: 'invite'; token: string }
  | { kind: 'return'; path: ReturnPath };

export interface AfterSignInInput {
  canGoBack: boolean;
  link: LinkState;
  /** An invite that arrived before sign-in. */
  pendingInvite: string | null;
  /** From `currentReturnTo`: already checked for expiry. */
  returnTo: ReturnPath | null;
  signedIn: boolean;
}

/**
 * - A return note only answers a link opened here, so a note left behind never steers an
 *   ordinary sign-in.
 * - A link that arrives while the traveller is already in the app (Android re-delivering it from
 *   Recents, a second tap on the website's button) goes back to where they were, not to Journeys.
 */
export function afterSignIn(input: AfterSignInInput): AfterSignIn {
  if (!input.signedIn || input.link.kind === 'opening' || input.link.kind === 'failed') return { kind: 'stay' };
  if (input.link.kind === 'opened' && input.returnTo) return { kind: 'return', path: input.returnTo };
  if (input.pendingInvite) return { kind: 'invite', token: input.pendingInvite };
  return input.link.kind === 'opened' && input.canGoBack ? { kind: 'back' } : { kind: 'home' };
}
